package com.tche.blog.task;

import java.nio.file.Path;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.tche.blog.service.LocalLogService;

import jakarta.annotation.Resource;

@Component
public class LogUploadTask {
  private static final Logger LOGGER = LoggerFactory.getLogger(LogUploadTask.class);

  @Resource
  private LocalLogService localLogService;

  @Scheduled(cron = "0 0 12 * * ?")
  public void uploadLogsAtNoon() {
    LOGGER.info("Starting scheduled log upload task at noon");
    uploadPendingLogs();
  }

  @Scheduled(cron = "0 0 0 * * ?")
  public void cleanupCurrentDayLogMarker() {
    LOGGER.info("Log cleanup marker triggered");
  }

  private void uploadPendingLogs() {
    List<Path> pendingFiles = localLogService.getPendingLogFiles();

    if (pendingFiles.isEmpty()) {
      LOGGER.info("No pending log files to upload");
      return;
    }

    LOGGER.info("Found {} pending log files to upload", pendingFiles.size());

    int successCount = 0;
    int failCount = 0;

    for (Path logFile : pendingFiles) {
      try {
        boolean success = localLogService.uploadLogFile(logFile);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (Exception e) {
        LOGGER.error("Failed to upload log file: {}", logFile.getFileName(), e);
        failCount++;
      }
    }

    LOGGER.info("Log upload task completed: success={}, failed={}", successCount, failCount);
  }
}
