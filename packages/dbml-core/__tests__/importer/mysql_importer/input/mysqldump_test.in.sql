-- MySQL dump 10.13  Distrib 8.0.33, for Win64 (x86_64)
--
-- Host: localhost    Database: siv
-- ------------------------------------------------------
-- Server version	8.0.33

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `api_key_outer_auth`
--

DROP TABLE IF EXISTS `api_key_outer_auth`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_key_outer_auth` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `api_key_outer_id` bigint NOT NULL,
  `flag` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `UQE_api_key_outer_auth_api_key_outer_auth_af` (`api_key_outer_id`,`flag`) USING BTREE,
  KEY `IDX_api_key_outer_auth_id` (`id`) USING BTREE,
  KEY `IDX_api_key_outer_auth_api_key_outer_id` (`api_key_outer_id`) USING BTREE,
  KEY `IDX_api_key_outer_auth_flag` (`flag`) USING BTREE,
  KEY `IDX_api_key_outer_auth_created_at` (`created_at`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `entity`
--

DROP TABLE IF EXISTS `entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entity` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'The database table row id',
  `dateCreated` timestamp NULL DEFAULT (now()) COMMENT 'Date / time created',
  `dateEdited` timestamp NULL DEFAULT (now()) COMMENT 'Date / time last modified',
  `createdBy` varchar(40) NOT NULL DEFAULT '' COMMENT 'The person who created the record',
  `editedBy` varchar(40) NOT NULL DEFAULT '' COMMENT 'The person who last modified the record',
  `constituentId` varchar(40) NOT NULL COMMENT 'The globally unique identifier for this constituent',
  `name` varchar(255) NOT NULL,
  `ein` varchar(16) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `constituentId` (`constituentId`),
  UNIQUE KEY `ein` (`ein`),
  KEY `entity_index_0` (`constituentId`),
  KEY `entity_index_1` (`ein`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `entity2`
--

DROP TABLE IF EXISTS `entity2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entity2` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'The database table row id',
  `dateCreated` timestamp NULL DEFAULT (now()) COMMENT 'Date / time created',
  `dateEdited` timestamp NULL DEFAULT (now()) COMMENT 'Date / time last modified',
  `createdBy` varchar(40) NOT NULL DEFAULT '' COMMENT 'The person who created the record',
  `editedBy` varchar(40) NOT NULL DEFAULT '' COMMENT 'The person who last modified the record',
  `constituentId` varchar(40) NOT NULL COMMENT 'The globally unique identifier for this constituent',
  `name` varchar(255) NOT NULL DEFAULT 'hello',
  `ein` varchar(16) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `constituentId` (`constituentId`),
  UNIQUE KEY `ein` (`ein`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2023-12-01 10:43:34
