const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const fastcsv = require('fast-csv');
const multer = require('multer');
const path = require('path');

// Configuración de PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'hr',
    password: 'utm123',
    port: 5432,
});

// Configuración de Express y Multer
const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = 3000;

// Exportar datos a CSV
app.get('/export-regions', async(req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM regions');
        client.release();

        const csvStream = fastcsv.format({ headers: true });
        res.setHeader('Content-Disposition', 'attachment; filename="regions.csv"');
        res.setHeader('Content-Type', 'text/csv');

        csvStream.pipe(res);
        result.rows.forEach(row => csvStream.write(row));
        csvStream.end();
    } catch (error) {
        console.error('Error al exportar datos:', error);
        res.status(500).send('Error al exportar datos');
    }
});

// Importar datos desde un archivo CSV
app.post('/import-regions', upload.single('file'), (req, res) => {
    const filePath = req.file.path;

    const data = [];
    fs.createReadStream(filePath)
        .pipe(fastcsv.parse({ headers: true }))
        .on('data', row => {
            data.push(row);
        })
        .on('end', async() => {
            try {
                const client = await pool.connect();

                await Promise.all(
                    data.map(row => {
                        return client.query(
                            'INSERT INTO regions (region_id, region_name) VALUES ($1, $2) ON CONFLICT (region_id) DO NOTHING', [row.region_id, row.region_name]
                        );
                    })
                );

                client.release();
                res.send('Datos importados correctamente');
            } catch (error) {
                console.error('Error al importar datos:', error);
                res.status(500).send('Error al importar datos');
            } finally {
                fs.unlinkSync(filePath); // Elimina el archivo después de procesarlo
            }
        });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});