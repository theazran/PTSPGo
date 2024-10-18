-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Sep 20, 2024 at 03:49 AM
-- Server version: 8.0.30
-- PHP Version: 8.1.10

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `queue_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `queue`
--

CREATE TABLE `queue` (
  `id` int NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `whatsapp` varchar(20) DEFAULT NULL,
  `photo` varchar(255) DEFAULT NULL,
  `ktp_photo` varchar(255) DEFAULT NULL,
  `service_id` int DEFAULT NULL,
  `status` enum('waiting','calling','served') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'waiting',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date` date DEFAULT NULL,
  `is_called` tinyint(1) DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_called` timestamp NULL DEFAULT NULL,
  `service_queue_number` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `queue`
--

INSERT INTO `queue` (`id`, `name`, `whatsapp`, `photo`, `ktp_photo`, `service_id`, `status`, `created_at`, `date`, `is_called`, `updated_at`, `last_called`, `service_queue_number`) VALUES
(59, 'asra', 'a', '/photos/photo-face-c76092c8-fa6c-469a-a303-ebf53a2acda4.jpg', '/photos/photo-ktp-c76092c8-fa6c-469a-a303-ebf53a2acda4.jpg', 1, 'served', '2024-09-19 15:17:56', '2024-09-19', 0, '2024-09-19 15:20:59', '2024-09-19 15:20:36', 'A004'),
(60, 'Asran', '12312312312', '/photos/photo-face-3db47bcd-f477-4944-9774-aa8a476de492.jpg', '/photos/photo-ktp-3db47bcd-f477-4944-9774-aa8a476de492.jpg', 1, 'served', '2024-09-19 15:21:26', '2024-09-19', 0, '2024-09-19 15:22:51', '2024-09-19 15:21:29', 'A005'),
(61, 'fufufafa', 'qw', '/photos/photo-face-5c91e467-102b-4d2f-8139-85bb23424c2e.jpg', '/photos/photo-ktp-5c91e467-102b-4d2f-8139-85bb23424c2e.jpg', 1, 'served', '2024-09-20 03:02:12', '2024-09-20', 0, '2024-09-20 03:02:50', '2024-09-20 03:02:36', 'A001');

-- --------------------------------------------------------

--
-- Table structure for table `services`
--

CREATE TABLE `services` (
  `id` int NOT NULL,
  `name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `services`
--

INSERT INTO `services` (`id`, `name`) VALUES
(1, 'Umum'),
(2, 'Hukum'),
(3, 'Pidana'),
(4, 'Perdata'),
(5, 'Informasi');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `queue`
--
ALTER TABLE `queue`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `queue`
--
ALTER TABLE `queue`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=62;

--
-- AUTO_INCREMENT for table `services`
--
ALTER TABLE `services`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
