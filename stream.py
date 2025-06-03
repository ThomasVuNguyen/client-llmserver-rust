from flask import Flask, request, render_template, jsonify, Response
import requests
import json
import os
import time
import uuid

app = Flask(__name__)
chat_history = []

# Đảm bảo các thư mục tồn tại
os.makedirs('templates', exist_ok=True)
os.makedirs('static', exist_ok=True)

@app.route("/", methods=["GET"])
def home():
    return render_template("index.html", history=chat_history)

@app.route("/send", methods=["POST"])
def send_message():
    message = request.form.get("message", "")
    if not message.strip():
        return jsonify({"error": "Tin nhắn trống"}), 400
    
    chat_history.append({"role": "user", "content": message})
    
    try:
        # Ghi lại thời gian bắt đầu
        start_time = time.time()
        
        # Gọi API LLM (non-streaming for fallback)
        response = requests.post(
            "http://localhost:8080/v1/chat/completions",
            json={
                "model": "gemma-3-1b-it-rk3588-1.2.0",
                "messages": chat_history,
                "stream": False
            }
        )
        
        # Tính thời gian phản hồi
        end_time = time.time()
        response_time = round(end_time - start_time, 2)
        
        response_data = response.json()
        ai_response = response_data["choices"][0]["message"]["content"]
        
        # Thêm phản hồi vào lịch sử chat kèm thời gian phản hồi
        chat_history.append({
            "role": "assistant", 
            "content": ai_response,
            "response_time": response_time
        })
        
        return jsonify({"response": ai_response, "response_time": response_time})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/stream", methods=["POST"])
def stream_message():
    """New streaming endpoint"""
    message = request.form.get("message", "")
    if not message.strip():
        return jsonify({"error": "Tin nhắn trống"}), 400
    
    chat_history.append({"role": "user", "content": message})
    
    def generate():
        try:
            # Gọi API LLM với streaming
            response = requests.post(
                "http://localhost:8080/v1/chat/completions",
                json={
                    "model": "Qwen3-1.7B-RKLLM-v1.2.0",
                    "messages": chat_history,
                    "stream": True,
                    "temperature": 0.7
                },
                headers={"Accept": "text/event-stream"},
                stream=True,
                timeout=30
            )
            
            full_response = ""
            start_time = time.time()
            
            # Gửi event bắt đầu
            yield f"data: {json.dumps({'type': 'start'})}\n\n"
            
            # Xử lý streaming response
            for line in response.iter_lines(decode_unicode=True):
                if line.strip():
                    try:
                        chunk = json.loads(line)
                        
                        if 'choices' in chunk and len(chunk['choices']) > 0:
                            choice = chunk['choices'][0]
                            
                            # Kiểm tra finish reason
                            if choice.get('finish_reason') == 'stop':
                                break
                            
                            # Lấy content từ message
                            if 'message' in choice and choice['message']:
                                content = choice['message'].get('content', '')
                                if content:
                                    full_response += content
                                    yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
                                    
                    except json.JSONDecodeError:
                        continue
            
            # Tính thời gian phản hồi
            end_time = time.time()
            response_time = round(end_time - start_time, 2)
            
            # Thêm vào lịch sử chat
            chat_history.append({
                "role": "assistant",
                "content": full_response,
                "response_time": response_time
            })
            
            # Gửi event kết thúc
            yield f"data: {json.dumps({'type': 'end', 'response_time': response_time})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return Response(generate(), mimetype='text/event-stream')

@app.route("/clear", methods=["POST"])
def clear_history():
    """Clear chat history"""
    global chat_history
    chat_history = []
    return jsonify({"success": True})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)