// Importation des modules du js
const dotenv = require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bodyParser = require("body-parser");
const pm2 = require("pm2");
const { Console } = require('console');
const { error } = require('console');
const cooking = require('cooking');
const process = require('process');
const axios = require('axios');

// Configuration du serveur
const port = 9000; 
const app = express();

// Protection contre les injections SQL
const sqlInjectionProtection = (req, res, next) => {
    const regex = /['"\\]/g; // Caractères à interdire
    for (const key in req.body) {
        if (typeof req.body[key] === 'string') {
            req.body[key] = req.body[key].replace(regex, '');
        }
    }
    next();
};

// Configuration de la connexion à PM2
pm2.connect({
    host: '192.168.64.175',
    port:9100,
    user: 'site1',
    password: 'yuzu007',
    database: 'classements'
}, (err) => {
    if (err) {
        console.error(err);
        process.exit(2);
    }
});

// Connexion à PM2
pm2.connect((err) => {
    if (err) {
        console.error(err);
        process.exit(2);
    }
    pm2.start({
        script: 'server.js', // chemin vers le fichier de votre serveur
        name: 'mon-serveur', // nom de votre application
        exec_mode: 'cluster', // mode d'exécution (cluster ou fork)
        instances: 1, // nombre d'instances
        watch: false, // activer la surveillance des fichiers
    }, (err, apps) => {
        pm2.disconnect();
        if (err) throw err;
    });
});

// Limite de requêtes pour éviter le spam (5 requêtes max par 1 minute par IP)
const limiter = rateLimit({
    windowMs: 1 * 60 * 10000, // 1 minute
    max: 25,
    message: "hahahahah!!!! Tu as trop fait de tentatives. Alors réessayez plus tard. hahahahhhah!!!",
});

// Configuration des middlewares
app.use(cors()); // Middleware pour autoriser les requêtes CORS
app.use(express.urlencoded({ extended: true })); // Middleware pour parser les données URL-encoded
app.use(cookieParser()); // Middleware pour parser les cookies
app.use(express.json()) // Middleware pour parser le JSON
app.use(limiter); // Appliquer le middleware de protection contre les spam et l'appliquer à toutes les routes
app.use(sqlInjectionProtection); // Appliquer le middleware de protection contre les injections SQL

// Configuration de la connexion à la base de données
const bddConnection = mysql.createConnection({
    host: '192.168.64.175',
    user: 'site1',
    password: 'yuzu007',
    database: 'classements'
});

// Connexion à la base de données
bddConnection.connect(function (err) {
    if (err) throw err;
    console.log("Vous êtes enfin connecté sur le serveur !");
});

// Middleware d'authentification
function authenticateToken(req, res, next) {
    const token = req.cookies.token; // Récupérer le token depuis les cookies
    if (token == null) return res.status(401).json('Token manquant');

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.status(403).json('Token invalide');
        req.user = user;
        next();
    });
}

function calculerClassement(matchs) {
    const classement = {};

    matchs.forEach(match => {
        const { Equipe1, Equipe2, Butequipe1, Butequipe2, nom_equipe1, nom_equipe2 } = match;

        if (!classement[Equipe1]) {
            classement[Equipe1] = {
                id: Equipe1,
                nom: nom_equipe1,
                matchsJoues: 0,
                gagne: 0,
                perdu: 0,
                nul: 0,
                points: 0,
                butsPour: 0,
                butsContre: 0,
                differenceButs: 0,
            };
        }
        if (!classement[Equipe2]) {
            classement[Equipe2] = {
                id: Equipe2,
                nom: nom_equipe2,
                matchsJoues: 0,
                gagne: 0,
                perdu: 0,
                nul: 0,
                points: 0,
                butsPour: 0,
                butsContre: 0,
                differenceButs: 0,
            };
        }

        classement[Equipe1].matchsJoues += 1;
        classement[Equipe2].matchsJoues += 1;

        classement[Equipe1].butsPour += Butequipe1;
        classement[Equipe1].butsContre += Butequipe2;

        classement[Equipe2].butsPour += Butequipe2;
        classement[Equipe2].butsContre += Butequipe1;

        // Résultat
        if (Butequipe1 > Butequipe2) {
            classement[Equipe1].points += 3;
            classement[Equipe1].gagne += 1;
            classement[Equipe2].perdu += 1;
        } else if (Butequipe2 > Butequipe1) {
            classement[Equipe2].points += 3;
            classement[Equipe2].gagne += 1;
            classement[Equipe1].perdu += 1;
        } else {
            classement[Equipe1].points += 1;
            classement[Equipe2].points += 1;
            classement[Equipe1].nul += 1;
            classement[Equipe2].nul += 1;
        }

        classement[Equipe1].differenceButs = classement[Equipe1].butsPour - classement[Equipe1].butsContre;
        classement[Equipe2].differenceButs = classement[Equipe2].butsPour - classement[Equipe2].butsContre;
    });

    const classementArray = Object.values(classement);

    classementArray.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.differenceButs !== a.differenceButs) return b.differenceButs - a.differenceButs;
        return b.butsPour - a.butsPour;
    });

    // On ajoute le rang ici
    classementArray.forEach((equipe, index) => {
        equipe.rang = index + 1;
    });

    return classementArray;
}

// Fonction pour déterminer le vainqueur d'un match
function determinerVainqueur(matchs) {
    const vainqueurs = [];

    matchs.forEach(match => {
        const { Equipe1, Equipe2, Butequipe1, Butequipe2, nom_equipe1, nom_equipe2 } = match;

        if (Butequipe1 > Butequipe2) {
            vainqueurs.push({ vainqueur: nom_equipe1 });
        } else if (Butequipe2 > Butequipe1) {
            vainqueurs.push({ vainqueur: nom_equipe2 });
        } else {
            vainqueurs.push({ vainqueur: "Match nul" });
        }
    });

    return vainqueurs;
}

// Vérification du token d'authentification
function verifierToken(req, res, next) {
    const token = req.cookies.token; // Récupérer le token depuis les cookies
    if (token == null) return res.status(401).json('Token manquant');

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.status(403).json('Token invalide');
        req.user = user;
        next();
    });
}

// Routes générales
app.get('/', (req, res) => {
    res.json('Bonjour, ceci est notre serveur (back-end), soyez les bienvenus ! ajouter un /accueil dans URL pour accéder à la page d\'accueil');
});

// Route d'accueil
app.get('/accueil', verifierToken, (req, res) => {
    res.status(200).json({ message: `Bienvenue! Vous êtes dans la page d\'accueil. Soyez les bienvenus sur cette page ${req.user.nom}` });
});

// Routes d'authentification
app.post('/inscription', async (req, res) => {
    try {
        const { nom, mdp } = req.body;

        // Hachage du mot de passe
        const hashedPassword = await bcrypt.hash(mdp, 10);

        // Vérifie si l'utilisateur existe déjà
        bddConnection.query('SELECT * FROM users WHERE nom = ?', [nom], async (err, rows) => {
            if (err) return res.status(500).json({ message: "Erreur SQL" });

            if (rows.length > 0) {
                return res.status(400).json({ message: "Utilisateur déjà existant" });
            }

            // Insertion dans la base
            bddConnection.query('INSERT INTO users (nom, mdp) VALUES (?, ?)', [nom, hashedPassword], (err2, result) => {
                if (err2) return res.status(500).json({ message: "Erreur lors de l'insertion" });

                res.status(201).json({ message: "Utilisateur enregistré avec succès" });
            });
        });

    } catch (e) {
        res.status(500).json({ message: "Erreur serveur" });
    }
});

app.post('/login', async (req, res) => {
    const { nom, mdp } = req.body;

    // Vérifie que tous les champs sont fournis
    if (!nom || !mdp) return res.status(400).json({ message: 'Veuillez remplir tous les champs.' });

    // Recherche l'utilisateur par son nom
    bddConnection.query('SELECT * FROM users WHERE nom = ?', [nom], async (err, rows) => {
        if (err) {
            console.error('Erreur SQL :', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Utilisateur non trouvé' });
        }

        try {
            const userInDB = rows[0];

            // Vérifie le mot de passe haché
            const match = await bcrypt.compare(mdp, userInDB.mdp);

            if (!match) {
                return res.status(401).json({ message: 'Mot de passe incorrect' });
            }

            // Crée un objet utilisateur minimal pour le token
            const userPayload = { id: userInDB.id, nom: userInDB.nom };

            // Génère un token JWT
            const secret = process.env.ACCESS_TOKEN_SECRET || 'default_secret';
            const accessToken = jwt.sign(userPayload, secret, { expiresIn: '1h' });
            console.log('Token généré :', accessToken);

            // Envoie le token dans un cookie sécurisé
            res.cookie('token', accessToken, {
                httpOnly: true,
                secure: true, // Mets false si tu testes en local sans HTTPS
                sameSite: 'Strict',
                maxAge: 3600000 // 1h
            });

            res.status(200).json({ message: 'Connexion réussie', accessToken });

        } catch (error) {
            console.error('Erreur auth :', error);
            res.status(500).json({ message: 'Erreur lors de l\'authentification' });
        }
    });
});

// route pour se deconnecter
app.post('/logout', (req, res) => {
    res.clearCookie('token'); // Supprimer le cookie de session
    res.json('Déconnexion réussie');
});

// Routes pour les utilisateurs
app.get('/users', (req, res) => {
    bddConnection.query('SELECT * FROM users', function (err, rows) {
        if (err) throw err;
        res.json(rows);
    });
});

// route pour ajouter un utilisateur
app.post('/users', async (req, res) => {
    const { nom, mdp } = req.body;
    console.log("nom: " + nom + " mdp: " + mdp);

    // Vérification des données reçues
    if (!nom || !mdp) {
        return res.status(400).json({ message: "Nom et mot de passe requis" });
    }
    
    try {
        // Hachage du mot de passe (à implémenter correctement)
        // const hashedPassword = await bcrypt.hash(mdp, 10);
        
        bddConnection.query('INSERT INTO users (nom, mdp) VALUES (?, ?)', [nom, mdp], function (err, result) {
            if (err) {
                return res.status(500).json({ message: "Erreur lors de l'insertion dans la base de données", error: err.message });
            }
            res.json({ message: "Utilisateur ajouté avec succès", result: result });
        });
    } catch (error) {
        res.status(500).json({ message: "Erreur interne du serveur", error: error.message });
    }
});

app.put('/users/:id', (req, res) => {
    let id = req.params.id;
    let newClassement = 2;
    bddConnection.query('UPDATE users SET classement = ? WHERE id = ?', [newClassement, id], function (err, rows) {
        if (err) throw err;
        res.json('Classement modifié');
    });
});

app.delete('/users/:id', (req, res) => {
    let id = req.params.id;
    bddConnection.query('DELETE FROM users WHERE id = ?', id, function (err, rows) {
        if (err) throw err;
        res.json('Utilisateur supprimé de la base de données');
    });
});

// Routes admin pour les utilisateurs
app.get('/admin/users', (req, res) => {
    console.log("Requête reçue pour récupérer les utilisateurs");    
    if (!bddConnection) {
        console.error("Erreur : la connexion à la base de données n'est pas établie.");
        return res.status(500).json({ message: "Erreur serveur : connexion DB manquante" });
    }

    const sql = "SELECT * FROM users";
    bddConnection.query(sql, (err, result) => {
        if (err) {
            console.error("Erreur SQL :", err);
            return res.status(500).json({ message: "Erreur serveur" });
        }
        if (result.length === 0) {
            return res.status(404).json({ message: "Aucun utilisateur trouvé" });
        }
        console.log("Utilisateurs récupérés :", result);
        res.status(200).json(result);
    });
});

app.post('/admin/users', (req, res) => {
    const { id, nom, mdp } = req.body;

    if (!id || !nom || !mdp || !role) {
        return res.status(400).json({ message: "Données manquantes" });
    }

    const sql = "INSERT INTO users (id, nom, mdp) VALUES (?, ?, ?, ?)";
    bddConnection.query(sql, [id, nom, mdp], (err, result) => {
        if (err) {
            console.error("Erreur lors de l'insertion :", err);
            return res.status(500).json({ message: "Erreur serveur" });
        }
        res.status(201).json({ message: "Utilisateur ajouté !" });
    });
});

app.get('/admin/users/:id', (req, res) => {
    const id = req.params.id;
    console.log("ID reçu :", id);
    if (!bddConnection) {
        console.error("Erreur : connexion à la base de données manquante.");
        return res.status(500).json({ message: "Erreur serveur : connexion DB manquante" });
    }
    const sql = "SELECT * FROM users WHERE id = ?";
    console.log("Requête SQL exécutée :", sql, "avec ID :", id);
    bddConnection.query(sql, [id], (err, result) => {
        if (err) {
            console.error("Erreur SQL :", err);
            return res.status(500).json({ message: "Erreur serveur" });
        }
        console.log("Résultat MySQL :", result);
        if (result.length === 0) {
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }
        res.status(200).json(result[0]);
    });
});

app.put('/admin/users/:id', (req, res) => {
    const userId = req.params.id;
    const { nom, mdp} = req.body;

    if (!nom || !mdp) {
        return res.status(400).json({ message: "Données manquantes" });
    }

    const sql = "UPDATE users SET nom = ?, mdp = ? WHERE id = ?";
    bddConnection.query(sql, [nom, mdp, userId], (err, result) => {
        if (err) {
            console.error("Erreur lors de la mise à jour :", err);
            return res.status(500).json({ message: "Erreur serveur" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        res.status(200).json({ message: "Utilisateur mis à jour !" });
    });
});

app.delete('/admin/users/:id', (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM users WHERE id = ?";
    bddConnection.query(sql, [id], (err, result) => {
        if (err) {
            console.error("Erreur lors de la suppression de l'utilisateur :", err);
            return res.status(500).json({ message: "Erreur serveur" });
        }
        res.status(200).json({ message: "Utilisateur supprimé !" });
    });
});

// Routes pour l'administration
app.get('/admin/connexion', (req, res) => {
    const sql = "SELECT * FROM Admin";
    bddConnection.query(sql, (err, result) => {
        if (err) {
            console.error("Erreur SQL :", err);
            return res.status(500).json({ message: "Erreur serveur" });
        }
        if (result.length === 0) {
            return res.status(404).json({ message: "Aucun admin trouvé" });
        }
        console.log("Admins récupérés :", result);
        res.status(200).json(result);
    });
});

app.get('/admin/connexion/:id', (req, res) => {
    const id = req.params.id;
    console.log("ID reçu :", id);
    if (!bddConnection) {
        console.error("Erreur : connexion à la base de données manquante.");
        return res.status(500).json({ message: "Erreur serveur : connexion DB manquante" });
    }
    const sql = "SELECT * FROM Admin WHERE id = ?";
    console.log("Requête SQL exécutée :", sql, "avec ID :", id);
    bddConnection.query(sql, [id], (err, result) => {
        if (err) {
            console.error("Erreur SQL :", err);
            return res.status(500).json({ message: "Erreur serveur" });
        }
        console.log("Résultat MySQL :", result);
        if (result.length === 0) {
            return res.status(404).json({ message: "Admin non trouvé" });
        }
        res.status(200).json(result[0]);
    });
});

app.post('/admin/connexion', async (req, res) => {
    const { nom, mdp, email } = req.body;

    if (!nom || !mdp || !email) {
        return res.status(400).json({ error: "Tous les champs sont requis." });
    }

    try {
        const hashedmdp = await bcrypt.hash(mdp, 10); // Hachage du mot de passe

        const query = "INSERT INTO Admin (nom, mdp, email) VALUES (?, ?, ?)";
        bddConnection.query(query, [nom, hashedmdp, email], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Erreur lors de l'ajout de l'admin" });
            }
            res.status(201).json({ message: "Admin ajouté avec succès !" });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur lors du hachage du mot de passe" });
    }
});

app.put('/admin/connexion/:id', (req, res) => {
    const id = req.params.id;
    const { nom, mdp, email } = req.body;

    if (!nom || !mdp || !email) {
        return res.status(400).json({ error: "Tous les champs sont requis." });
    }

    const query = "UPDATE Admin SET nom = ?, mdp = ?, email = ? WHERE id = ?";
    bddConnection.query(query, [nom, mdp, email, id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Erreur lors de la mise à jour de l'admin" });
        }
        res.status(200).json({ message: "Admin mis à jour avec succès !" });
    });
});

app.delete('/admin/connexion/:id', (req, res) => {
    const id = req.params.id;
    const query = "DELETE FROM Admin WHERE id = ?";
    bddConnection.query(query, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Erreur lors de la suppression de l'admin" });
        }
        res.status(200).json({ message: "Admin supprimé avec succès !" });
    });
});

// Routes pour les équipes
app.get('/equipes', (req, res) => {
    const query = "SELECT * FROM equipe";
    
    bddConnection.query(query, (error, results, fields) => {
        if (error) {
            console.error("Erreur MySQL lors de la récupération des équipes:", error);
            return res.status(500).json({ error: "Erreur lors de la récupération des équipes" });
        }
        
        console.log(`${results.length} équipes récupérées avec succès`);
        res.json({
            success: true,
            count: results.length,
            equipes: results
        });
    });
});

app.get('/admin/equipes/:id', (req, res) => {
    const id = req.params.id;

    // Vérification que l'ID est un nombre valide
    if (isNaN(id)) {
        return res.status(400).json({ message: "ID invalide. L'ID doit être un nombre." });
    }
    const query = "SELECT * FROM Equipe WHERE id = ?";
    bddConnection.query(query, [id], (error, results, fields) => {
        if (error) {
            console.error("Erreur MySQL :", error);
            return res.status(500).json({ message: "Erreur serveur lors de la récupération de l'équipe" });
        }      
        if (results.length === 0) {
            return res.status(404).json({ message: "Equipe non trouvée" });
        }
        res.json(results[0]);
    });
});

app.post('/admin/equipes', (req, res) => {
    // Assurez-vous que express.json() middleware est bien configuré avant cette route
    const { nom } = req.body;
    console.log("Données reçues pour l'équipe :", req.body);
    
    // Vérification que le nom est fourni
    if (!nom || typeof nom !== 'string' || nom.trim() === '') {
      return res.status(400).json({ error: "Le nom de l'équipe est requis et doit être une chaîne de caractères valide." });
    }
    
    const query = "INSERT INTO equipe (nom) VALUES (?)";
    bddConnection.query(query, [nom], (err, result) => {
        if (err) {
            console.error("Erreur MySQL lors de l'ajout de l'équipe :", err);
            return res.status(500).json({ error: "Erreur lors de l'ajout de l'équipe" });
        }
        console.log("Équipe ajoutée avec succès, ID:", result.insertId);
        res.status(201).json({ 
            message: "Equipe ajoutée avec succès !",
            id: result.insertId,
            nom: nom
        });
    });
});

app.put('/admin/equipes/:id', (req, res) => {
    const id = req.params.id;
    const { nom } = req.body;
    const query = "UPDATE Equipe SET nom = ? WHERE id = ?";
    bddConnection.query(query, [nom, id], (error, results, fields) => {
        if (error) throw error;
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Equipe non trouvée" });
        }
        res.json({ message: "Equipe mise à jour avec succès !" });
    });
});

app.delete('/admin/equipes/:id', (req, res) => {
    const id = req.params.id;
    const query = "DELETE FROM Equipe WHERE id = ?";
    bddConnection.query(query, [id], (error, results, fields) => {
        if (error) throw error;
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Equipe non trouvée" });
        }
        res.json({ message: "Equipe supprimée avec succès !" });
    });
});

// Routes pour les matchs
app.get('/matchs', (req, res) => {
    const query = `
    SELECT 
        m.id, 
        m.Equipe1, 
        m.Equipe2, 
        m.Butequipe1, 
        m.Butequipe2, 
        e1.nom AS nom_equipe1, 
        e2.nom AS nom_equipe2
    FROM 
        Matchs m
    JOIN 
        equipe e1 ON m.Equipe1 = e1.id
    JOIN 
        equipe e2 ON m.Equipe2 = e2.id;
    `;

    bddConnection.query(query, (error, results, fields) => {
        if (error) throw error;
        res.json(results);
    });
});

// Route pour récupérer l'id d'un match spécifique
app.get('/admin/matchs/:id', (req, res) => {
    const id = req.params.id;
    const query = `
    SELECT
        m.id,
        m.Equipe1,
        m.Equipe2,
        m.Butequipe1,
        m.Butequipe2,
        e1.nom AS nom_equipe1,
        e2.nom AS nom_equipe2
    FROM
        Matchs m
    JOIN
        equipe e1 ON m.Equipe1 = e1.id
    JOIN
        equipe e2 ON m.Equipe2 = e2.id
    WHERE
        m.id = ?;
    `;
    bddConnection.query(query, [id], (error, results, fields) => {
        if (error) {
            console.error("Erreur MySQL lors de la récupération du match :", error);
            return res.status(500).json({ error: "Erreur lors de la récupération du match" });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: "Match non trouvé" });
        }
        res.json(results[0]);
    }
    );
});

app.post('/admin/matchs', (req, res) => {
    const { Equipe1, Equipe2, Butequipe1, Butequipe2 } = req.body;
    console.log("Données reçues pour le match :", req.body);
    if (!Equipe1 || !Equipe2 || !Butequipe1 || !Butequipe2) {
        return res.status(400).json({ error: "Tous les champs sont requis." });
    }

    const query = "INSERT INTO Matchs (Equipe1, Equipe2, Butequipe1, Butequipe2) VALUES (?, ?, ?, ?)";
    bddConnection.query(query, [Equipe1, Equipe2, Butequipe1, Butequipe2], (err, result) => {
        if (err) {
            console.error("Erreur MySQL lors de l'ajout du match :", err);
            return res.status(500).json({ error: "Erreur lors de l'ajout du match" });
        }
        console.log("Match ajouté avec succès, ID:", result.insertId);
        res.status(201).json({
            message: "Match ajouté avec succès !",
            id: result.insertId,
            Equipe1: Equipe1,
            Equipe2: Equipe2,
            Butequipe1: Butequipe1,
            Butequipe2: Butequipe2
        });
    });
});
app.put('/admin/matchs/:id', (req, res) => {
    const id = req.params.id;
    const { Equipe1, Equipe2, Butequipe1, Butequipe2 } = req.body;
    const query = "UPDATE Matchs SET Equipe1 = ?, Equipe2 = ?, Butequipe1 = ?, Butequipe2 = ? WHERE id = ?";
    bddConnection.query(query, [Equipe1, Equipe2, Butequipe1, Butequipe2, id], (error, results, fields) => {
        if (error) {
            console.error("Erreur MySQL lors de la mise à jour du match :", error);
            return res.status(500).json({ error: "Erreur lors de la mise à jour du match" });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Match non trouvé" });
        }
        res.json({ message: "Match mis à jour avec succès !" });
    }
    );
});

app.delete('/admin/matchs/:id', (req, res) => {
    const id = req.params.id;
    const query = "DELETE FROM Matchs WHERE id = ?";
    bddConnection.query(query, [id], (error, results, fields) => {
        if (error) {
            console.error("Erreur MySQL lors de la suppression du match :", error);
            return res.status(500).json({ error: "Erreur lors de la suppression du match" });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Match non trouvé" });
        }
        res.json({ message: "Match supprimé avec succès !" });
    });
});

// Fonction pour calculer le classement
function calculerClassement(matchs) {
    const classement = {};

    matchs.forEach(match => {
        const { Equipe1, Equipe2, Butequipe1, Butequipe2, nom_equipe1, nom_equipe2 } = match;

        if (!classement[Equipe1]) {
            classement[Equipe1] = {
                id: Equipe1,
                nom: nom_equipe1,
                matchsJoues: 0,
                gagne: 0,
                perdu: 0,
                nul: 0,
                points: 0,
                butsPour: 0,
                butsContre: 0,
                differenceButs: 0,
            };
        }
        if (!classement[Equipe2]) {
            classement[Equipe2] = {
                id: Equipe2,
                nom: nom_equipe2,
                matchsJoues: 0,
                gagne: 0,
                perdu: 0,
                nul: 0,
                points: 0,
                butsPour: 0,
                butsContre: 0,
                differenceButs: 0,
            };
        }

        classement[Equipe1].matchsJoues += 1;
        classement[Equipe2].matchsJoues += 1;

        classement[Equipe1].butsPour += Butequipe1;
        classement[Equipe1].butsContre += Butequipe2;

        classement[Equipe2].butsPour += Butequipe2;
        classement[Equipe2].butsContre += Butequipe1;

        // Résultat
        if (Butequipe1 > Butequipe2) {
            classement[Equipe1].points += 3;
            classement[Equipe1].gagne += 1;
            classement[Equipe2].perdu += 1;
        } else if (Butequipe2 > Butequipe1) {
            classement[Equipe2].points += 3;
            classement[Equipe2].gagne += 1;
            classement[Equipe1].perdu += 1;
        } else {
            classement[Equipe1].points += 1;
            classement[Equipe2].points += 1;
            classement[Equipe1].nul += 1;
            classement[Equipe2].nul += 1;
        }

        classement[Equipe1].differenceButs = classement[Equipe1].butsPour - classement[Equipe1].butsContre;
        classement[Equipe2].differenceButs = classement[Equipe2].butsPour - classement[Equipe2].butsContre;
    });

    const classementArray = Object.values(classement);

    classementArray.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.differenceButs !== a.differenceButs) return b.differenceButs - a.differenceButs;
        return b.butsPour - a.butsPour;
    });

    // On ajoute le rang ici
    classementArray.forEach((equipe, index) => {
        equipe.rang = index + 1;
    });

    return classementArray;
}

// Routes pour les classements
app.get('/classement', (req, res) => {
    const query = `
    SELECT 
        m.id, 
        m.Equipe1, 
        m.Equipe2, 
        m.Butequipe1, 
        m.Butequipe2, 
        e1.nom AS nom_equipe1, 
        e2.nom AS nom_equipe2
    FROM 
        Matchs m
    JOIN 
        equipe e1 ON m.Equipe1 = e1.id
    JOIN 
        equipe e2 ON m.Equipe2 = e2.id;
    `;

    bddConnection.query(query, (error, results, fields) => {
        if (error) throw error;
      
        // Traiter les résultats pour calculer le classement
        const classement = calculerClassement(results);
      
        console.log(classement);
        res.json(classement);
    });
});

//route pour les classements en admin
app.get('/admin/classement', (req, res) => {
    const query = "SELECT * FROM Classement";
    
    bddConnection.query(query, (error, results, fields) => {
        if (error) {
            console.error("Erreur MySQL lors de la récupération des classements:", error);
            return res.status(500).json({ error: "Erreur lors de la récupération des classements" });
        }
        
        console.log(`${results.length} classements récupérés avec succès`);
        res.json({
            success: true,
            count: results.length,
            classements: results
        });
    });
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.post('/admin/classement', (req, res) => {
    const { nom, matchsJoues, gagne, perdu, nul, points, butsPour, butsContre, differenceButs } = req.body;

    console.log("Données reçues pour le classement :", req.body);

    if (!nom || typeof nom !== 'string' || nom.trim() === '') {
        return res.status(400).json({ error: "Le nom de l'équipe est requis et doit être une chaîne de caractères valide." });
    }

    const matchsJouesNum = parseInt(matchsJoues) || 0;
    const gagneNum = parseInt(gagne) || 0;
    const perduNum = parseInt(perdu) || 0;
    const nulNum = parseInt(nul) || 0;
    const pointsNum = parseInt(points) || 0;
    const butsPourNum = parseInt(butsPour) || 0;
    const butsContreNum = parseInt(butsContre) || 0;
    const differenceButsNum = parseInt(differenceButs) || 0;

    const insertQuery = `
        INSERT INTO Classement (nom, matchsJoues, gagne, perdu, nul, points, butsPour, butsContre, differenceButs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    bddConnection.query(insertQuery, [
        nom,
        matchsJouesNum,
        gagneNum,
        perduNum,
        nulNum,
        pointsNum,
        butsPourNum,
        butsContreNum,
        differenceButsNum
    ], (err, result) => {
        if (err) {
            console.error("Erreur MySQL lors de l'ajout du classement :", err);
            return res.status(500).json({ error: "Erreur lors de l'ajout du classement" });
        }

        const newId = result.insertId;

        const classementQuery = `
            SELECT id, nom, points, differenceButs
            FROM Classement
            ORDER BY points DESC, differenceButs DESC
        `;

        bddConnection.query(classementQuery, (err, rows) => {
            if (err) {
                console.error("Erreur lors de la récupération du classement :", err);
                return res.status(500).json({ error: "Erreur lors du calcul du rang" });
            }

            const rang = rows.findIndex(equipe => equipe.id === newId) + 1;

            // Mise à jour du rang dans la BDD
            const updateRangQuery = `UPDATE Classement SET rang = ? WHERE id = ?`;

            bddConnection.query(updateRangQuery, [rang, newId], (err) => {
                if (err) {
                    console.error("Erreur lors de la mise à jour du rang :", err);
                    return res.status(500).json({ error: "Erreur lors de la mise à jour du rang" });
                }

                res.status(201).json({
                    message: "Classement ajouté avec succès !",
                    id: newId,
                    equipe: nom,
                    rang: rang,
                    stats: {
                        matchsJoues: matchsJouesNum,
                        gagne: gagneNum,
                        perdu: perduNum,
                        nul: nulNum,
                        points: pointsNum,
                        butsPour: butsPourNum,
                        butsContre: butsContreNum,
                        differenceButs: differenceButsNum
                    }
                });
            });
        });
    });
});

app.put('/admin/classement/:id', (req, res) => {
    const id = req.params.id;
    const { nom, matchsJoues, gagne, perdu, nul, points, butsPour, butsContre, differenceButs } = req.body;
    const query = `
        UPDATE Classement
        SET nom = ?, matchsJoues = ?, gagne = ?, perdu = ?, nul = ?, points = ?, butsPour = ?, butsContre = ?, differenceButs = ?
        WHERE id = ?
    `;
    bddConnection.query(query, [nom, matchsJoues, gagne, perdu, nul, points, butsPour, butsContre, differenceButs, id], (error, results, fields) => {
        if (error) throw error;
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Classement non trouvé" });
        }
        res.json({ message: "Classement mis à jour avec succès !" });
    });
});
app.delete('/admin/classement/:id', (req, res) => {
    const id = req.params.id;
    const query = "DELETE FROM Classement WHERE id = ?";
    bddConnection.query(query, [id], (error, results, fields) => {
        if (error) throw error;
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Classement non trouvé" });
        }
        res.json({ message: "Classement supprimé avec succès !" });
    });
});
////////////////////////////////////////////////////////////////////////////////////////////////////

// Routes pour les vainqueurs
app.get('/vainqueur', (req, res) => {
    const query = `
    SELECT 
        m.id, 
        m.Equipe1, 
        m.Equipe2, 
        m.Butequipe1, 
        m.Butequipe2, 
        e1.nom AS nom_equipe1, 
        e2.nom AS nom_equipe2
    FROM 
        Matchs m
    JOIN 
        equipe e1 ON m.Equipe1 = e1.id
    JOIN 
        equipe e2 ON m.Equipe2 = e2.id;
    `;

    bddConnection.query(query, (error, results, fields) => {
        if (error) throw error;
      
        // Traiter les résultats pour déterminer le vainqueur
        const vainqueur = determinerVainqueur(results);
      
        console.log(vainqueur);
        res.json(vainqueur);
    });
});

app.post('/admin/vainqueur', (req, res) => {
    const { nom, equipe, annee } = req.body;
    console.log("Données reçues pour le vainqueur :", req.body);

    // Vérification des données
    if (!nom || typeof nom !== 'string' || nom.trim() === '') {
        return res.status(400).json({ error: "Le nom du vainqueur est requis et doit être une chaîne de caractères valide." });
    }

    if (!equipe || isNaN(equipe)) {
        return res.status(400).json({ error: "Le numéro de l'équipe est requis et doit être un nombre valide." });
    }

    if (!annee || typeof annee !== 'string' || annee.trim() === '') {
        return res.status(400).json({ error: "L'année est requise et doit être une chaîne de caractères valide." });
    }

    // Requête SQL avec les 3 champs
    const query = "INSERT INTO vainqueur (nom, equipe, annee) VALUES (?, ?, ?)";
    bddConnection.query(query, [nom.trim(), equipe, annee.trim()], (err, result) => {
        if (err) {
            console.error("Erreur MySQL lors de l'ajout du vainqueur :", err);
            return res.status(500).json({ error: "Erreur lors de l'ajout du vainqueur." });
        }
        console.log("Vainqueur ajouté avec succès, ID:", result.insertId);
        res.status(201).json({
            message: "Vainqueur ajouté avec succès !",
            id: result.insertId,
            nom,
            equipe,
            annee
        });
    });
});

app.put('/admin/vainqueur/:id', (req, res) => {
    const id = req.params.id;
    const { nom } = req.body;
    const query = "UPDATE Vainqueur SET nom = ? WHERE id = ?";
    bddConnection.query(query, [nom, id], (error, results, fields) => {
        if (error) throw error;
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Vainqueur non trouvé" });
        }
        res.json({ message: "Vainqueur mis à jour avec succès !" });
    });
});

app.delete('/admin/vainqueur/:id', (req, res) => {
    const id = req.params.id;
    const query = "DELETE FROM Vainqueur WHERE id = ?";
    bddConnection.query(query, [id], (error, results, fields) => {
        if (error) throw error;
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Vainqueur non trouvé" });
        }
        res.json({ message: "Vainqueur supprimé avec succès !" });
    });
});

// Test de requête SQL directe
bddConnection.query('SELECT * FROM users', (err, results) => {
    if (err) {
      console.error('Erreur lors de l\'exécution de la requête :', err.stack);
      return;
    }
    console.log('Résultats de la requête :', results);
});

// Fermeture de la connexion à la base de données lorsque le processus se termine
process.on('SIGINT', () => {
    bddConnection.end(err => {
        if (err) {
            console.error('Erreur lors de la fermeture de la connexion à la base de données :', err.stack);
        } else {
            console.log('Connexion à la base de données fermée.');
        }
        process.exit();
    });
});

// Démarrage du serveur
app.listen(port, () => {
    console.log(`Le serveur est en écoute sur le port ${port}`);
});