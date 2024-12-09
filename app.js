// Importar dependencias
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import router from './service.js'; // Importar el router
import cors from 'cors';

// Definir __dirname para ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de variables de entorno
dotenv.config();

// Crear instancia de Express
const app = express();

// Configuración del puerto
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());
//app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3001' }));
// Middleware para servir archivos estáticos
app.use('/img', express.static(path.join(__dirname, 'public/img')));

// Usar las rutas del archivo service.js
app.use('/', router);

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

export default app;