class SSEManager {
  constructor() {
    this.clients = new Map();
    this.clientId = 0;

    // 15초마다 heartbeat
    setInterval(() => {
      this.broadcast('heartbeat', { type: 'ping' });
    }, 15000);
  }

  addClient(req, res) {
    const id = ++this.clientId;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Nginx 버퍼링 비활성화
    });

    // 연결 즉시 연결 확인 이벤트
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id })}\n\n`);

    this.clients.set(id, res);

    req.on('close', () => {
      this.clients.delete(id);
    });

    return id;
  }

  broadcast(event, data) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, res] of this.clients) {
      try {
        res.write(message);
      } catch {
        this.clients.delete(id);
      }
    }
  }

  getClientCount() {
    return this.clients.size;
  }
}

module.exports = SSEManager;
