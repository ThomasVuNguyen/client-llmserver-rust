document.addEventListener('DOMContentLoaded', function() {
  const chatContainer = document.getElementById('chat');
  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('input');
  const sendButton = document.getElementById('send-button');
  
  // Cuộn xuống cuối chat khi tải trang
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  messageForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Thêm tin nhắn người dùng vào chat
    appendMessage('user', message);
    
    // Xóa input và vô hiệu hóa nút gửi
    messageInput.value = '';
    sendButton.disabled = true;
    
    // Thêm chỉ báo đang gõ
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message assistant typing-indicator';
    typingIndicator.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;
    chatContainer.appendChild(typingIndicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Ghi lại thời gian bắt đầu (phía client)
    const startTime = new Date().getTime();
    
    // Gửi tin nhắn qua AJAX
    fetch('/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `message=${encodeURIComponent(message)}`
    })
    .then(response => response.json())
    .then(data => {
      // Xóa chỉ báo đang gõ
      chatContainer.removeChild(typingIndicator);
      
      if (data.error) {
        appendMessage('assistant', `Lỗi: ${data.error}`);
      } else {
        // Hiển thị phản hồi kèm thời gian
        appendMessage('assistant', data.response, data.response_time);
      }
    })
    .catch(error => {
      chatContainer.removeChild(typingIndicator);
      appendMessage('assistant', 'Xin lỗi, đã xảy ra lỗi khi xử lý tin nhắn của bạn.');
      console.error('Error:', error);
    })
    .finally(() => {
      // Kích hoạt lại nút gửi và focus vào input
      sendButton.disabled = false;
      messageInput.focus();
    });
  });
  
  // Hàm thêm tin nhắn vào khung chat
  function appendMessage(role, content, responseTime = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = content;
    messageDiv.appendChild(messageContent);
    
    // Thêm thời gian phản hồi nếu là tin nhắn từ assistant
    if (role === 'assistant' && responseTime !== null) {
      const timeElement = document.createElement('div');
      timeElement.className = 'response-time';
      timeElement.textContent = `Thời gian phản hồi: ${responseTime} giây`;
      messageDiv.appendChild(timeElement);
    }
    
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
});
