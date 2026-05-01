-- Kaivalya Guru — Spin The Wheel
-- Run once on your MySQL server

CREATE DATABASE IF NOT EXISTS kaivalyaguru
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE kaivalyaguru;

CREATE TABLE IF NOT EXISTS kg_entries (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name   VARCHAR(100)  NOT NULL,
  last_name    VARCHAR(100)  NOT NULL,
  email        VARCHAR(255)  NOT NULL,
  mobile       VARCHAR(15)   NOT NULL,
  dob          DATE          NOT NULL,
  feedback     TEXT,
  coupon_code  VARCHAR(20)   DEFAULT NULL,
  prize        VARCHAR(255)  DEFAULT NULL,
  has_spun     TINYINT(1)    NOT NULL DEFAULT 0,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email  (email),
  UNIQUE KEY uq_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
