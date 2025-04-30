-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost
-- Généré le : mer. 30 avr. 2025 à 15:29
-- Version du serveur : 10.5.23-MariaDB-0+deb11u1
-- Version de PHP : 7.4.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `classements`
--

DELIMITER $$
--
-- Procédures
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `update_classements` ()  DETERMINISTIC BEGIN
    -- Réinitialiser le classement
    UPDATE Classement SET 
        matchsJoues = 0, 
        gagne = 0, 
        perdu = 0, 
        nul = 0, 
        points = 0, 
        butsPour = 0, 
        butsContre = 0, 
        differenceButs = 0;

    -- Mettre à jour à partir des matchs terminés
    UPDATE Classement c
    JOIN equipe e ON c.equipe_id = e.id
    LEFT JOIN (
        SELECT 
            Equipe1 as equipe_id,
            COUNT(*) as joues,
            SUM(CASE WHEN Butequipe1 > Butequipe2 THEN 1 ELSE 0 END) as victoires,
            SUM(CASE WHEN Butequipe1 < Butequipe2 THEN 1 ELSE 0 END) as defaites,
            SUM(CASE WHEN Butequipe1 = Butequipe2 THEN 1 ELSE 0 END) as nuls,
            SUM(CASE WHEN Butequipe1 > Butequipe2 THEN 3 WHEN Butequipe1 = Butequipe2 THEN 1 ELSE 0 END) as pts,
            SUM(Butequipe1) as bp,
            SUM(Butequipe2) as bc
        FROM Matchs
        WHERE statut = 'terminé'
        GROUP BY Equipe1
    ) as home ON home.equipe_id = c.equipe_id
    SET 
        c.matchsJoues = IFNULL(home.joues, 0),
        c.gagne = IFNULL(home.victoires, 0),
        c.perdu = IFNULL(home.defaites, 0),
        c.nul = IFNULL(home.nuls, 0),
        c.points = IFNULL(home.pts, 0),
        c.butsPour = IFNULL(home.bp, 0),
        c.butsContre = IFNULL(home.bc, 0);

    -- Ajouter les matchs à l'extérieur
    UPDATE Classement c
    JOIN equipe e ON c.equipe_id = e.id
    LEFT JOIN (
        SELECT 
            Equipe2 as equipe_id,
            COUNT(*) as joues,
            SUM(CASE WHEN Butequipe2 > Butequipe1 THEN 1 ELSE 0 END) as victoires,
            SUM(CASE WHEN Butequipe2 < Butequipe1 THEN 1 ELSE 0 END) as defaites,
            SUM(CASE WHEN Butequipe2 = Butequipe1 THEN 1 ELSE 0 END) as nuls,
            SUM(CASE WHEN Butequipe2 > Butequipe1 THEN 3 WHEN Butequipe2 = Butequipe1 THEN 1 ELSE 0 END) as pts,
            SUM(Butequipe2) as bp,
            SUM(Butequipe1) as bc
        FROM Matchs
        WHERE statut = 'terminé'
        GROUP BY Equipe2
    ) as away ON away.equipe_id = c.equipe_id
    SET 
        c.matchsJoues = c.matchsJoues + IFNULL(away.joues, 0),
        c.gagne = c.gagne + IFNULL(away.victoires, 0),
        c.perdu = c.perdu + IFNULL(away.defaites, 0),
        c.nul = c.nul + IFNULL(away.nuls, 0),
        c.points = c.points + IFNULL(away.pts, 0),
        c.butsPour = c.butsPour + IFNULL(away.bp, 0),
        c.butsContre = c.butsContre + IFNULL(away.bc, 0);

    -- Calculer les différences de buts
    UPDATE Classement
    SET differenceButs = butsPour - butsContre;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `Admin`
--

CREATE TABLE `Admin` (
  `id` int(11) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `mdp` varchar(255) NOT NULL,
  `email` varchar(150) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `Admin`
--

INSERT INTO `Admin` (`id`, `nom`, `mdp`, `email`) VALUES
(1, 'admin1', '$2b$10$Iwy5UM4i9VS2SBFcMr2FIeXJhbotJHGOMd32WOJ/sB1XZgRoSFHcC', 'admin1@gmail.com'),
(2, 'Jonas', '$2b$10$QnsD9gLBI4zNDoJd8/mZYOvqYvCmiwyBuEyzD493qTSrKH0jkgaY6', 'Jonas.admin@gmail.com');

-- --------------------------------------------------------

--
-- Structure de la table `classement`
--

CREATE TABLE `classement` (
  `id` int(11) NOT NULL,
  `equipe` int(11) NOT NULL,
  `matchsJoues` int(11) NOT NULL DEFAULT 0,
  `gagne` int(11) NOT NULL DEFAULT 0,
  `perdu` int(11) NOT NULL DEFAULT 0,
  `nul` int(11) NOT NULL DEFAULT 0,
  `points` int(11) NOT NULL DEFAULT 0,
  `butsPour` int(11) NOT NULL DEFAULT 0,
  `butsContre` int(11) NOT NULL DEFAULT 0,
  `differenceButs` int(11) NOT NULL DEFAULT 0,
  `annee` varchar(20) DEFAULT '2024-2025',
  `rang` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `equipe`
--

CREATE TABLE `equipe` (
  `id` int(11) NOT NULL,
  `nom` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `equipe`
--

INSERT INTO `equipe` (`id`, `nom`) VALUES
(11, '1 BAC PRO'),
(10, '2TNE'),
(13, '3PM'),
(9, 'BTS ELEC'),
(7, 'CIEL1'),
(8, 'CIEL2'),
(22, 'Superstart'),
(12, 'TLES BAC PRO');

-- --------------------------------------------------------

--
-- Structure de la table `login`
--

CREATE TABLE `login` (
  `id` int(11) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `mdp` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `matchs`
--

CREATE TABLE `matchs` (
  `id` int(11) NOT NULL,
  `Equipe1` int(11) NOT NULL,
  `Equipe2` int(11) NOT NULL,
  `Butequipe1` int(11) NOT NULL DEFAULT 0,
  `Butequipe2` int(11) NOT NULL DEFAULT 0,
  `date_match` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `matchs`
--

INSERT INTO `matchs` (`id`, `Equipe1`, `Equipe2`, `Butequipe1`, `Butequipe2`, `date_match`) VALUES
(8, 11, 7, 3, 0, '2025-04-01 21:37:24'),
(9, 11, 8, 2, 4, '2025-04-02 21:37:24'),
(10, 11, 9, 3, 3, '2025-04-03 21:37:24'),
(11, 11, 10, 2, 1, '2025-04-04 21:37:24'),
(12, 11, 12, 2, 5, '2025-04-05 21:37:24'),
(13, 11, 13, 9, 0, '2025-04-06 21:37:24'),
(14, 10, 7, 4, 2, '2025-04-07 21:37:24'),
(15, 10, 8, 2, 6, '2025-04-08 21:37:24'),
(16, 10, 9, 4, 5, '2025-04-09 21:37:24'),
(17, 10, 12, 4, 3, '2025-04-10 21:37:24'),
(18, 10, 13, 8, 1, '2025-04-11 21:37:24'),
(19, 13, 7, 1, 10, '2025-04-12 21:37:24'),
(20, 13, 8, 0, 12, '2025-04-13 21:37:24'),
(21, 13, 9, 0, 10, '2025-04-14 21:37:24'),
(22, 13, 12, 0, 9, '2025-04-15 21:37:24'),
(23, 9, 7, 0, 0, '2025-04-16 21:37:24'),
(24, 9, 8, 0, 0, '2025-04-20 21:37:24'),
(25, 9, 12, 2, 3, '2025-04-21 21:37:24'),
(26, 7, 8, 1, 1, '2025-04-22 21:37:24'),
(27, 7, 9, 2, 3, '2025-04-23 21:37:24'),
(28, 11, 7, 3, 0, '2025-04-01 21:37:24'),
(29, 11, 8, 2, 4, '2025-04-02 21:37:24'),
(30, 11, 9, 3, 3, '2025-04-03 21:37:24'),
(31, 11, 10, 2, 1, '2025-04-04 21:37:24'),
(32, 11, 12, 2, 5, '2025-04-05 21:37:24'),
(33, 11, 13, 9, 0, '2025-04-06 21:37:24'),
(34, 10, 7, 4, 2, '2025-04-07 21:37:24'),
(35, 10, 8, 2, 6, '2025-04-08 21:37:24'),
(36, 10, 9, 4, 5, '2025-04-09 21:37:24'),
(37, 10, 12, 4, 3, '2025-04-10 21:37:24'),
(38, 10, 13, 8, 1, '2025-04-11 21:37:24'),
(39, 13, 7, 1, 10, '2025-04-12 21:37:24'),
(40, 13, 8, 0, 12, '2025-04-13 21:37:24'),
(41, 13, 9, 0, 10, '2025-04-14 21:37:24'),
(42, 13, 12, 0, 9, '2025-04-15 21:37:24'),
(43, 9, 7, 0, 0, '2025-04-16 21:37:24'),
(44, 9, 8, 0, 0, '2025-04-20 21:37:24'),
(45, 9, 12, 2, 3, '2025-04-21 21:37:24'),
(46, 7, 8, 1, 1, '2025-04-22 21:37:24'),
(47, 7, 9, 2, 3, '2025-04-23 21:37:24');

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `mdp` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `vainqueur`
--

CREATE TABLE `vainqueur` (
  `id` int(11) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `equipe` int(11) DEFAULT NULL,
  `annee` varchar(20) DEFAULT '2024'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `Admin`
--
ALTER TABLE `Admin`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `classement`
--
ALTER TABLE `classement`
  ADD PRIMARY KEY (`id`),
  ADD KEY `equipe_id` (`equipe`);

--
-- Index pour la table `equipe`
--
ALTER TABLE `equipe`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nom` (`nom`);

--
-- Index pour la table `login`
--
ALTER TABLE `login`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nom` (`nom`);

--
-- Index pour la table `matchs`
--
ALTER TABLE `matchs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Equipe1` (`Equipe1`),
  ADD KEY `Equipe2` (`Equipe2`);

--
-- Index pour la table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`nom`);

--
-- Index pour la table `vainqueur`
--
ALTER TABLE `vainqueur`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nom` (`nom`),
  ADD KEY `equipe_id` (`equipe`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `Admin`
--
ALTER TABLE `Admin`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `classement`
--
ALTER TABLE `classement`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT pour la table `equipe`
--
ALTER TABLE `equipe`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT pour la table `login`
--
ALTER TABLE `login`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `matchs`
--
ALTER TABLE `matchs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=48;

--
-- AUTO_INCREMENT pour la table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT pour la table `vainqueur`
--
ALTER TABLE `vainqueur`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `classement`
--
ALTER TABLE `classement`
  ADD CONSTRAINT `classement_ibfk_1` FOREIGN KEY (`equipe`) REFERENCES `equipe` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `matchs`
--
ALTER TABLE `matchs`
  ADD CONSTRAINT `matchs_ibfk_1` FOREIGN KEY (`Equipe1`) REFERENCES `equipe` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `matchs_ibfk_2` FOREIGN KEY (`Equipe2`) REFERENCES `equipe` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `vainqueur`
--
ALTER TABLE `vainqueur`
  ADD CONSTRAINT `vainqueur_ibfk_1` FOREIGN KEY (`equipe`) REFERENCES `equipe` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
