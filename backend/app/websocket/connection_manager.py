"""WebSocket Connection Manager for Real-Time Streaming."""
from fastapi import WebSocket
from typing import List, Dict, Any
import json
import logging

logger = logging.getLogger("aerotwin.websocket")

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Active: {len(self.active_connections)}")

    async def broadcast_json(self, message: Dict[str, Any]):
        """Broadcast JSON message to all connected clients."""
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                dead_connections.append(connection)

        for dc in dead_connections:
            if dc in self.active_connections:
                self.active_connections.remove(dc)

manager = ConnectionManager()
