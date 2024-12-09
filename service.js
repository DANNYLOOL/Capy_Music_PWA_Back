// Importar dependencias
import express from 'express';
import pkg from 'pg';
import multer from 'multer';
import path from 'path';

const { Pool } = pkg;

// Crear un router
const router = express.Router();

// Configurar el pool de PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER || 'postgres', // Usuario de la base de datos
    host: process.env.DB_HOST || 'junction.proxy.rlwy.net', // Host de la base de datos
    database: process.env.DB_NAME || 'railway', // Nombre de la base de datos
    password: process.env.DB_PASSWORD || 'yKxixdniyolbPXUCRDPEVcNKptnJhAlQ', // Contraseña
    port: process.env.DB_PORT || 29402, // Puerto
});

// Verificar conexión a la base de datos al iniciar
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err.stack);
    } else {
        console.log('Conexión exitosa a la base de datos');
    }
    if (release) release();
});

// Configuración de multer para almacenar imágenes en la carpeta 'public/img'
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/img');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Ruta para verificar usuario y contraseña
router.get('/verify-user', async (req, res) => {
    const { username, password } = req.query;

    try {
        const query = 'SELECT * FROM users WHERE username = $1 AND password = $2';
        const values = [username, password];
        const result = await pool.query(query, values);

        if (result.rows.length > 0) {
            res.json({ success: true, message: 'Usuario autenticado con éxito.' });
        } else {
            res.json({ success: false, message: 'Usuario o contraseña incorrectos.' });
        }
    } catch (error) {
        console.error('Error en la verificación de usuario:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// Ruta para agregar canción
router.post('/add-song', upload.single('cover'), async (req, res) => {
    const { songName, artist, album } = req.body;
    const coverPath = `/img/${req.file.filename}`; // Ruta relativa de la imagen

    try {
        const query = 'INSERT INTO songs (name, artist, album, cover) VALUES ($1, $2, $3, $4) RETURNING *';
        const values = [songName, artist, album, coverPath];
        const result = await pool.query(query, values);

        res.status(200).json({
            success: true,
            message: 'Canción agregada con éxito.',
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Error al agregar canción:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// Ruta para obtener canciones con paginación
router.get('/songs', async (req, res) => {
    try {
        // Obtener parámetros de consulta con valores predeterminados
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        // Consultar el total de canciones para calcular el número de páginas
        const countQuery = 'SELECT COUNT(*) FROM songs';
        const countResult = await pool.query(countQuery);
        const totalSongs = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalSongs / limit);

        // Consultar las canciones con paginación
        const query = 'SELECT * FROM songs LIMIT $1 OFFSET $2';
        const result = await pool.query(query, [limit, offset]);

        // Respuesta con las canciones y datos de paginación
        res.status(200).json({
            success: true,
            songs: result.rows,
            totalPages,
            currentPage: parseInt(page, 10),
        });
    } catch (error) {
        console.error('Error al obtener canciones con paginación:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// Ruta para obtener una canción por ID
router.get('/song/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = 'SELECT * FROM songs WHERE id = $1';
        const values = [id];
        const result = await pool.query(query, values);
        if (result.rows.length > 0) {
            res.status(200).json({ success: true, song: result.rows[0] });
        } else {
            res.status(404).json({ success: false, message: 'Canción no encontrada' });
        }
    } catch (error) {
        console.error('Error al obtener canción:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// Ruta para actualizar canción
router.post('/update-song/:id', upload.single('cover'), async (req, res) => {
    const { id } = req.params;
    const { songName, artist, album } = req.body; // Procesa los campos de texto
    const cover = req.file ? `/img/${req.file.filename}` : undefined;

    try {
        // Construir consulta dinámica solo con los campos proporcionados
        const updates = [];
        const values = [];
        let query = 'UPDATE songs SET ';

        if (songName) {
            updates.push(`name = $${updates.length + 1}`);
            values.push(songName);
        }
        if (artist) {
            updates.push(`artist = $${updates.length + 1}`);
            values.push(artist);
        }
        if (album) {
            updates.push(`album = $${updates.length + 1}`);
            values.push(album);
        }
        if (cover) {
            updates.push(`cover = $${updates.length + 1}`);
            values.push(cover);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'No hay cambios para actualizar.' });
        }

        query += updates.join(', ') + ` WHERE id = $${updates.length + 1} RETURNING *`;
        values.push(id);

        const result = await pool.query(query, values);

        if (result.rowCount > 0) {
            res.status(200).json({ success: true, message: 'Canción actualizada con éxito.', song: result.rows[0] });
        } else {
            res.status(404).json({ success: false, message: 'Canción no encontrada.' });
        }
    } catch (error) {
        console.error('Error al actualizar canción:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// Ruta para eliminar una canción por ID
router.delete('/song/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = 'DELETE FROM songs WHERE id = $1 RETURNING *';
        const values = [id];
        const result = await pool.query(query, values);

        if (result.rowCount > 0) {
            res.status(200).json({ success: true, message: 'Canción eliminada con éxito.', song: result.rows[0] });
        } else {
            res.status(404).json({ success: false, message: 'Canción no encontrada.' });
        }
    } catch (error) {
        console.error('Error al eliminar canción:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// Exportar el router
export default router;