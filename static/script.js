document.addEventListener('DOMContentLoaded', function() {
  const chatContainer = document.getElementById('chat');
  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('input');
  const sendButton = document.getElementById('send-button');
  const streamToggle = document.getElementById('stream-toggle');
  const clearButton = document.getElementById('clear-button');
  
  // Cuộn xuống cuối chat khi tải trang
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  // Xử lý nút clear
  if (clearButton) {
    clearButton.addEventListener('click', function() {
      if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử chat?')) {
        clearChatHistory();
      }
    });
  }
  
  messageForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Kiểm tra nếu streaming được bật
    const useStreaming = streamToggle ? streamToggle.checked : true;
    
    if (useStreaming) {
      sendStreamingMessage(message);
    } else {
      sendRegularMessage(message);
    }
  });
  
  function sendStreamingMessage(message) {
    // Thêm tin nhắn người dùng vào chat
    appendMessage('user', message);
    
    // Xóa input và vô hiệu hóa nút gửi
    messageInput.value = '';
    sendButton.disabled = true;
    
    // Tạo container cho phản hồi streaming
    const responseContainer = document.createElement('div');
    responseContainer.className = 'message assistant streaming';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    responseContainer.appendChild(messageContent);
    
    chatContainer.appendChild(responseContainer);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Gửi form data cho streaming endpoint
    const formData = new FormData();
    formData.append('message', message);
    
    fetch('/stream', {
      method: 'POST',
      body: formData
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      function readStream() {
        reader.read().then(({ done, value }) => {
          if (done) {
            responseContainer.classList.remove('streaming');
            sendButton.disabled = false;
            messageInput.focus();
            return;
          }
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                handleStreamEvent(data, messageContent, responseContainer);
              } catch (e) {
                console.error('Error parsing stream data:', e);
              }
            }
          }
          
          readStream();
        }).catch(error => {
          console.error('Stream reading error:', error);
          messageContent.textContent = 'Lỗi: Không thể đọc phản hồi streaming';
          responseContainer.classList.remove('streaming');
          sendButton.disabled = false;
          messageInput.focus();
        });
      }
      
      readStream();
    })
    .catch(error => {
      console.error('Streaming error:', error);
      messageContent.textContent = 'Lỗi: Không thể kết nối streaming';
      responseContainer.classList.remove('streaming');
      sendButton.disabled = false;
      messageInput.focus();
    });
  }
  
  function handleStreamEvent(data, messageContent, responseContainer) {
    switch (data.type) {
      case 'start':
        // Thêm cursor nhấp nháy
        messageContent.innerHTML = '<span class="cursor">▊</span>';
        break;
        
      case 'content':
        // Xóa cursor và thêm nội dung mới
        const currentText = messageContent.textContent.replace('▊', '');
        messageContent.innerHTML = currentText + data.content + '<span class="cursor">▊</span>';
        chatContainer.scrollTop = chatContainer.scrollHeight;
        break;
        
      case 'end':
        // Xóa cursor và thêm thời gian phản hồi
        messageContent.innerHTML = messageContent.textContent.replace('▊', '');
        
        if (data.response_time) {
          const timeElement = document.createElement('div');
          timeElement.className = 'response-time';
          timeElement.textContent = `Thời gian phản hồi: ${data.response_time} giây`;
          responseContainer.appendChild(timeElement);
        }
        
        responseContainer.classList.remove('streaming');
        sendButton.disabled = false;
        messageInput.focus();
        break;
        
      case 'error':
        messageContent.textContent = `Lỗi: ${data.error}`;
        responseContainer.classList.remove('streaming');
        sendButton.disabled = false;
        messageInput.focus();
        break;
    }
  }
  
  function sendRegularMessage(message) {
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
    
    // Gửi tin nhắn qua AJAX (non-streaming)
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
        appendMessage('assistant', data.response, data.response_time);
      }
    })
    .catch(error => {
      chatContainer.removeChild(typingIndicator);
      appendMessage('assistant', 'Xin lỗi, đã xảy ra lỗi khi xử lý tin nhắn của bạn.');
      console.error('Error:', error);
    })
    .finally(() => {
      sendButton.disabled = false;
      messageInput.focus();
    });
  }
  
  function clearChatHistory() {
    fetch('/clear', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Xóa tất cả tin nhắn trên UI
        chatContainer.innerHTML = '';
      }
    })
    .catch(error => {
      console.error('Error clearing chat:', error);
      alert('Lỗi khi xóa lịch sử chat');
    });
  }
  
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