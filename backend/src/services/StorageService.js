const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Determine storage path from command-line argument or fallback to local dev path
let dbDirectory;
const appdataArg = process.argv.find(arg => arg.startsWith('--appdata='));
if (appdataArg) {
    dbDirectory = appdataArg.split('=')[1];
} else {
    // Fallback for development: create in backend directory
    dbDirectory = path.join(__dirname, '..', '..');
}
const dbPath = path.join(dbDirectory, 'db.json');

console.log(`[StorageService] Database file path set to: ${dbPath}`);

class StorageService {
  constructor() {
    this.data = { connections: [] };
    this.read();
  }

  read() {
    try {
      if (fs.existsSync(dbPath)) {
        const fileContent = fs.readFileSync(dbPath, 'utf-8');
        // Handle empty file case
        if (fileContent) {
          this.data = JSON.parse(fileContent);
        } else {
          this.data = { connections: [] };
          this.write();
        }
      } else {
        // Create the directory if it doesn't exist
        fs.mkdirSync(dbDirectory, { recursive: true });
        this.write();
      }
    } catch (e) {
      console.error("[StorageService] Failed to read, parse, or create db.json", e);
      this.data = { connections: [] };
    }
  }

  write() {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error("[StorageService] Failed to write to db.json", e);
    }
  }

  getConnections() {
    return this.data.connections || [];
  }

  addConnection(connectionConfig) {
    const id = uuidv4();
    const newConnection = { id, ...connectionConfig };
    this.data.connections.push(newConnection);
    this.write();
    return newConnection;
  }

  updateConnection(connectionId, connectionConfig) {
    const connection = this.data.connections.find(c => c.id === connectionId);
    if (connection) {
      Object.assign(connection, connectionConfig);
      this.write();
      return connection;
    }
    return null;
  }

  removeConnection(connectionId) {
    this.data.connections = this.data.connections.filter(c => c.id !== connectionId);
    this.write();
  }
}

module.exports = new StorageService();
