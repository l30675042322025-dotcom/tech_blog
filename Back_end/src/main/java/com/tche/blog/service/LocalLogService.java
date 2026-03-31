package com.tche.blog.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tche.blog.config.AliyunOssProperties;
import com.tche.blog.config.StorageProperties;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LocalLogService {
  private static final Logger LOGGER = LoggerFactory.getLogger(LocalLogService.class);
  private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
  private static final String LOG_FILE_PREFIX = "activity_log_";
  private static final String LOG_FILE_SUFFIX = ".json";

  private final AliyunOssProperties aliyunOssProperties;
  private final StorageProperties storageProperties;
  private final ObjectStorageService objectStorageService;
  private final ObjectMapper objectMapper;

  private Path logDirectory;

  @PostConstruct
  public void init() {
    String configured = storageProperties.getLocalRoot();
    if (configured == null || configured.isBlank()) {
      logDirectory = Paths.get("aliyun").resolve(aliyunOssProperties.getLogDir());
    } else {
      logDirectory = Paths.get(configured).resolve(aliyunOssProperties.getLogDir());
    }
    try {
      Files.createDirectories(logDirectory);
      LOGGER.info("Local log directory initialized: {}", logDirectory.toAbsolutePath());
    } catch (IOException e) {
      LOGGER.error("Failed to create local log directory: {}", logDirectory.toAbsolutePath(), e);
    }
  }

  public void appendLog(String action, Long userId, Map<String, Object> extraPayload) {
    Map<String, Object> logEntry = new LinkedHashMap<>();
    logEntry.put("action", action);
    logEntry.put("userId", userId);
    logEntry.put("timestamp", LocalDateTime.now().toString());
    if (extraPayload != null && !extraPayload.isEmpty()) {
      logEntry.putAll(extraPayload);
    }

    String today = LocalDate.now().format(DATE_FORMATTER);
    Path logFile = logDirectory.resolve(LOG_FILE_PREFIX + today + LOG_FILE_SUFFIX);

    try {
      String jsonLine = objectMapper.writeValueAsString(logEntry) + System.lineSeparator();
      synchronized (LocalLogService.class) {
        Files.writeString(
          logFile,
          jsonLine,
          StandardCharsets.UTF_8,
          Files.exists(logFile) ? StandardOpenOption.APPEND : StandardOpenOption.CREATE
        );
      }
      LOGGER.debug("Log entry appended: action={}, userId={}", action, userId);
    } catch (JsonProcessingException e) {
      LOGGER.error("Failed to serialize log entry: {}", logEntry, e);
    } catch (IOException e) {
      LOGGER.error("Failed to write log entry to file: {}", logFile, e);
    }
  }

  public List<Path> getPendingLogFiles() {
    List<Path> pendingFiles = new ArrayList<>();
    if (!Files.exists(logDirectory)) {
      return pendingFiles;
    }

    try {
      Files.list(logDirectory)
        .filter(path -> path.toString().endsWith(LOG_FILE_SUFFIX))
        .filter(path -> !path.toString().contains(LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"))))
        .sorted()
        .forEach(pendingFiles::add);
    } catch (IOException e) {
      LOGGER.error("Failed to list pending log files", e);
    }

    return pendingFiles;
  }

  public boolean uploadLogFile(Path logFile) {
    if (!Files.exists(logFile) || !Files.isRegularFile(logFile)) {
      LOGGER.warn("Log file does not exist or is not a regular file: {}", logFile);
      return false;
    }

    try {
      String content = Files.readString(logFile, StandardCharsets.UTF_8);
      if (content.isBlank()) {
        LOGGER.info("Log file is empty, deleting: {}", logFile.getFileName());
        Files.deleteIfExists(logFile);
        return true;
      }

      String fileName = logFile.getFileName().toString();
      String aliyunPath = aliyunOssProperties.getLogDir() + "/" + fileName;

      objectStorageService.saveLogDirectly(content.getBytes(StandardCharsets.UTF_8), aliyunPath);
      LOGGER.info("Log file uploaded successfully: {} -> aliyun://{}", fileName, aliyunPath);

      Files.deleteIfExists(logFile);
      LOGGER.info("Local log file deleted after upload: {}", fileName);

      return true;
    } catch (IOException e) {
      LOGGER.error("Failed to upload log file: {}", logFile.getFileName(), e);
      return false;
    }
  }

  public Path getLogDirectory() {
    return logDirectory;
  }

  public String readLogFileContent(Path logFile) {
    try {
      if (!Files.exists(logFile)) {
        return null;
      }
      return Files.readString(logFile, StandardCharsets.UTF_8);
    } catch (IOException e) {
      LOGGER.error("Failed to read log file: {}", logFile, e);
      return null;
    }
  }
}
