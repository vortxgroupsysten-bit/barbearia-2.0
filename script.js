import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyClGuPVykO9JYXCCTipC-sHsXVZ0aDmFpE",
  authDomain: "painel-barbeiro.firebaseapp.com",
  databaseURL: "https://painel-barbeiro-default-rtdb.firebaseio.com",
  projectId: "painel-barbeiro",
  storageBucket: "painel-barbeiro.firebasestorage.app",
  messagingSenderId: "705166711606",
  appId: "1:705166711606:web:8efe81000b76b968807197"
};

let db;
try { 
    const app = initializeApp(firebaseConfig); 
    db = getFirestore(app); 
} catch (e) {
    console.log("Firebase não configurado ou erro na inicialização:", e);
}

// Elementos DOM
const dateSlotsContainer = document.getElementById('dateSlotsContainer');
const selectedDateInput = document.getElementById('selectedDate');
const slotsContainer = document.getElementById('timeSlotsContainer');
const selectedTimeInput = document.getElementById('selectedTime');
const form = document.getElementById('formAgendamento');
const submitBtn = document.getElementById('submitBtn');
const barberSelection = document.getElementById('barberSelection');
const timeSlotsInfo = document.getElementById('timeSlotsInfo');
const barberStatus = document.getElementById('barberStatus');

// Variáveis globais
let ocupadosCache = {};
let selectedBarber = 'Marcio';
let selectedDate = '';
let selectedTime = '';

// Horários disponíveis
const times = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

// Função para formatar telefone enquanto digita
function formatPhoneNumber(input) {
    let value = input.value.replace(/\D/g, '');
    value = value.substring(0, 11);
    
    if (value.length > 10) {
        value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (value.length > 6) {
        value = value.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
    } else if (value.length > 2) {
        value = value.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
    } else if (value.length > 0) {
        value = value.replace(/^(\d{0,2})$/, '($1');
    }
    
    input.value = value;
}

// Função para validar telefone
function isValidPhone(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10 && cleanPhone.length <= 11;
}

// Função para buscar horários ocupados
async function getOccupiedSlots(date, barber) {
    const cacheKey = `${date}-${barber}`;
    
    // Verificar cache
    if (ocupadosCache[cacheKey] && (Date.now() - ocupadosCache[cacheKey].timestamp < 30000)) {
        return ocupadosCache[cacheKey].data;
    }
    
    if (!db) return [];
    
    try {
        const q = query(
            collection(db, "agendamentos_barber"),
            where("data", "==", date),
            where("barbeiro", "==", barber)
        );
        
        const querySnapshot = await getDocs(q);
        const occupiedTimes = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            occupiedTimes.push(data.hora);
        });
        
        // Atualizar cache
        ocupadosCache[cacheKey] = {
            data: occupiedTimes,
            timestamp: Date.now()
        };
        
        return occupiedTimes;
    } catch (error) {
        console.error("Erro ao buscar horários ocupados:", error);
        return [];
    }
}

// Função para renderizar datas disponíveis
async function renderDateSlots() {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const today = new Date();
    today.setHours(0,0,0,0);

    dateSlotsContainer.innerHTML = '';

    for (let i = 0; i < 15; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        
        if (date.getDay() === 0) continue;

        const dayName = days[date.getDay()];
        const dayNum = date.getDate();
        const monthName = months[date.getMonth()];
        const fullDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        const card = document.createElement('div');
        card.className = 'date-card';
        card.innerHTML = `
            <span style="font-size: 0.65rem; color: var(--text-muted); display: block;">${dayName}</span>
            <span style="font-size: 1.3rem; font-weight: 700; color: white; display: block;">${dayNum}</span>
            <span style="font-size: 0.65rem; color: var(--gold); display: block;">${monthName}</span>
        `;

        card.onclick = async () => {
            document.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            selectedDate = fullDateStr;
            selectedDateInput.value = fullDateStr;
            await updateTimeSlots();
        };
        
        if (i === 0) {
            card.classList.add('active');
            selectedDate = fullDateStr;
            selectedDateInput.value = fullDateStr;
        }
        
        dateSlotsContainer.appendChild(card);
    }
}

// Função para renderizar horários disponíveis
async function renderTimeSlots() {
    if (!selectedDate || !selectedBarber) {
        timeSlotsInfo.textContent = "Selecione uma data e um barbeiro";
        return;
    }
    
    const occupiedTimes = await getOccupiedSlots(selectedDate, selectedBarber);
    
    slotsContainer.innerHTML = '';
    
    times.forEach(time => {
        const div = document.createElement('div');
        div.className = "selection-option";
        
        const isOccupied = occupiedTimes.includes(time);
        const isSelected = selectedTime === time;
        
        if (isOccupied) {
            div.classList.add('occupied');
        } else {
            div.classList.add('available');
        }
        
        div.innerHTML = `
            <input type="radio" name="t-slot" value="${time}" id="t-${time}" 
                   ${isOccupied ? 'disabled' : ''} ${isSelected ? 'checked' : ''}>
            <label for="t-${time}">${time}${isOccupied ? ' (Ocupado)' : ''}</label>
        `;
        
        const radioInput = div.querySelector('input');
        if (!isOccupied) {
            radioInput.onclick = (e) => {
                selectedTime = e.target.value;
                selectedTimeInput.value = selectedTime;
                updateSelectedTime();
            };
        }
        
        if (time === times[0] && !isOccupied && !selectedTime) {
            radioInput.checked = true;
            selectedTime = time;
            selectedTimeInput.value = time;
        }
        
        slotsContainer.appendChild(div);
    });
    
    // Atualizar informação
    const availableCount = times.length - occupiedTimes.length;
    timeSlotsInfo.textContent = `${availableCount} horários disponíveis para ${selectedBarber}`;
    timeSlotsInfo.style.color = availableCount > 0 ? '#4CAF50' : '#ff4444';
}

// Atualizar horários quando barbeiro ou data mudar
async function updateTimeSlots() {
    if (selectedDate && selectedBarber) {
        await renderTimeSlots();
    }
}

// Atualizar horário selecionado
function updateSelectedTime() {
    document.querySelectorAll('#timeSlotsContainer input').forEach(input => {
        const label = input.nextElementSibling;
        if (input.value === selectedTime && !input.disabled) {
            label.style.background = 'var(--gold)';
            label.style.color = '#000';
        }
    });
}

// Atualizar status do barbeiro
async function updateBarberStatus() {
    if (!selectedDate) return;
    
    const barbeiros = ['Marcio', 'Rodrigo', 'Vitor'];
    let statusText = '';
    
    for (const barber of barbeiros) {
        const occupiedTimes = await getOccupiedSlots(selectedDate, barber);
        const availableCount = times.length - occupiedTimes.length;
        
        if (barber === selectedBarber) {
            statusText += `<span style="color: var(--gold);">${barber}: ${availableCount} horários</span> | `;
        } else {
            statusText += `${barber}: ${availableCount} horários | `;
        }
    }
    
    barberStatus.innerHTML = statusText.slice(0, -3);
}

// Função para abrir/fechar modal de agendamento
window.toggleModal = (show) => {
    const modal = document.getElementById('bookingModal');
    modal.style.display = show ? 'flex' : 'none';
    
    setTimeout(() => {
        modal.classList.toggle('active', show);
    }, 10);
    
    document.body.style.overflow = show ? 'hidden' : 'auto';
    
    if (show) {
        // Resetar seleções
        selectedBarber = 'Marcio';
        selectedTime = '';
        document.querySelector('input[name="barber"][value="Marcio"]').checked = true;
        updateBarberStatus();
        updateTimeSlots();
    }
};

// Função para abrir/fechar modal de confirmação
window.toggleConfirmationModal = (show, details = null) => {
    const modal = document.getElementById('confirmationModal');
    modal.style.display = show ? 'flex' : 'none';
    
    setTimeout(() => {
        modal.classList.toggle('active', show);
    }, 10);
    
    if (show && details) {
        document.getElementById('confirmationDetails').innerHTML = details;
    }
    
    document.body.style.overflow = show ? 'hidden' : 'auto';
};

// Mostrar detalhes da confirmação
function showConfirmationDetails(data) {
    return `
        <div class="confirmation-detail">
            <span class="confirmation-label">Cliente:</span>
            <span class="confirmation-value">${data.cliente}</span>
        </div>
        <div class="confirmation-detail">
            <span class="confirmation-label">Telefone:</span>
            <span class="confirmation-value">${data.telefone}</span>
        </div>
        <div class="confirmation-detail">
            <span class="confirmation-label">Serviço:</span>
            <span class="confirmation-value">${data.servico}</span>
        </div>
        <div class="confirmation-detail">
            <span class="confirmation-label">Barbeiro:</span>
            <span class="confirmation-value barber">${data.barbeiro}</span>
        </div>
        <div class="confirmation-detail">
            <span class="confirmation-label">Data:</span>
            <span class="confirmation-value">${formatDate(data.data)}</span>
        </div>
        <div class="confirmation-detail">
            <span class="confirmation-label">Horário:</span>
            <span class="confirmation-value time">${data.hora}</span>
        </div>
    `;
}

// Formatar data para exibição
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('pt-BR', options);
}

// Função para agendar lembrete
function scheduleReminder(data) {
    // Separar data e hora
    const [year, month, day] = data.data.split('-');
    const [hours, minutes] = data.hora.split(':');
    
    // Criar data do agendamento
    const appointmentDate = new Date(year, month - 1, day, hours, minutes);
    
    // Calcular 15 minutos antes
    const reminderDate = new Date(appointmentDate.getTime() - (15 * 60 * 1000));
    
    // Verificar se o lembrete está no futuro
    if (reminderDate > new Date()) {
        const timeUntilReminder = reminderDate.getTime() - Date.now();
        
        setTimeout(() => {
            sendReminder(data);
        }, timeUntilReminder);
        
        console.log(`Lembrete agendado para ${reminderDate.toLocaleString('pt-BR')}`);
    } else {
        console.log("Horário já passou, não enviar lembrete");
    }
}

// Função para enviar lembrete (simulado)
function sendReminder(data) {
    const message = `Olá ${data.cliente}! Lembrete: Seu agendamento com ${data.barbeiro} está marcado para hoje às ${data.hora}. Confirmar presença?`;
    
    // Simulação de envio - em produção, integrar com WhatsApp Business API
    console.log("📱 ENVIANDO LEMBRETE:");
    console.log(`Para: ${data.telefone}`);
    console.log(`Mensagem: ${message}`);
    
    // Se tiver API do WhatsApp configurada, enviar aqui
    // Exemplo: fetch('https://api.whatsapp.com/send?phone=' + data.telefone + '&text=' + encodeURIComponent(message));
    
    // Mostrar notificação no console
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Barber Pro - Lembrete', {
            body: `Lembrete enviado para ${data.cliente}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/3067/3067256.png'
        });
    }
}

// Event listener para o formulário
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Pega os valores dos campos
    const clientName = document.getElementById('clientName').value;
    const clientPhone = document.getElementById('clientPhone').value;
    const barberSelected = document.querySelector('input[name="barber"]:checked').value;

    // Validações
    if (!clientName.trim()) {
        alert("Por favor, informe seu nome.");
        return;
    }
    
    if (!clientPhone.trim()) {
        alert("Por favor, informe seu telefone para contato.");
        return;
    }
    
    if (!isValidPhone(clientPhone)) {
        alert("Por favor, informe um telefone válido com DDD (ex: 11999999999).");
        return;
    }
    
    if (!selectedDate || !selectedTime) {
        alert("Por favor, selecione data e hora.");
        return;
    }
    
    // Verificar se horário ainda está disponível
    const occupiedTimes = await getOccupiedSlots(selectedDate, barberSelected);
    if (occupiedTimes.includes(selectedTime)) {
        alert("❌ Este horário acabou de ser ocupado. Por favor, escolha outro horário.");
        await updateTimeSlots();
        return;
    }

    const data = {
        cliente: clientName,
        telefone: clientPhone,
        servico: document.getElementById('serviceType').value,
        barbeiro: barberSelected,
        data: selectedDate,
        hora: selectedTime,
        createdAt: new Date().toISOString(),
        reminderSent: false
    };

    submitBtn.innerText = "Reservando...";
    submitBtn.disabled = true;

    try {
        let docRef;
        
        if (db) {
            docRef = await addDoc(collection(db, "agendamentos_barber"), data);
            console.log("Agendamento salvo com ID: ", docRef.id);
            
            // Limpar cache para esta data/barbeiro
            const cacheKey = `${selectedDate}-${barberSelected}`;
            delete ocupadosCache[cacheKey];
        }
        
        // Agendar lembrete
        scheduleReminder(data);
        
        // Mostrar modal de confirmação
        const details = showConfirmationDetails(data);
        toggleModal(false);
        setTimeout(() => {
            toggleConfirmationModal(true, details);
        }, 300);
        
        // Limpar formulário
        form.reset();
        
        // Resetar seleções
        selectedTime = '';
        selectedDate = '';
        await renderDateSlots();
        await updateTimeSlots();
        
    } catch (error) { 
        console.error("Erro ao salvar agendamento:", error);
        alert("❌ Erro ao salvar agendamento. Por favor, tente novamente."); 
    } finally {
        submitBtn.innerText = "Confirmar Reserva";
        submitBtn.disabled = false;
    }
});

// Event listeners para barbeiros
barberSelection.addEventListener('change', async (e) => {
    if (e.target.name === 'barber') {
        selectedBarber = e.target.value;
        await updateTimeSlots();
        await updateBarberStatus();
    }
});

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', async () => {
    // Pedir permissão para notificações
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    await renderDateSlots();
    
    // Adiciona formatação automática ao campo de telefone
    const phoneInput = document.getElementById('clientPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function() {
            formatPhoneNumber(this);
        });
    }
    
    // Selecionar primeiro barbeiro por padrão
    selectedBarber = 'Marcio';
    await updateBarberStatus();
    await updateTimeSlots();
    
    // Adicionar evento para atualizar quando data mudar
    document.querySelectorAll('input[name="barber"]').forEach(input => {
        input.addEventListener('change', async () => {
            selectedBarber = input.value;
            await updateTimeSlots();
            await updateBarberStatus();
        });
    });
});

// Fechar modal ao clicar fora do conteúdo
document.addEventListener('click', (e) => {
    const modal = document.getElementById('bookingModal');
    const confirmationModal = document.getElementById('confirmationModal');
    
    if (e.target === modal) {
        toggleModal(false);
    }
    if (e.target === confirmationModal) {
        toggleConfirmationModal(false);
    }
});

// Fechar modal com ESC
document.addEventListener('keydown', (e) => {
    const bookingModal = document.getElementById('bookingModal');
    const confirmationModal = document.getElementById('confirmationModal');
    
    if (e.key === 'Escape') {
        if (bookingModal.classList.contains('active')) {
            toggleModal(false);
        }
        if (confirmationModal.classList.contains('active')) {
            toggleConfirmationModal(false);
        }
    }
});