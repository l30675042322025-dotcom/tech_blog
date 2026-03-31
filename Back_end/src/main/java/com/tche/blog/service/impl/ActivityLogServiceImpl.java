package com.tche.blog.service.impl;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.tche.blog.service.ActivityLogService;
import com.tche.blog.service.LocalLogService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ActivityLogServiceImpl implements ActivityLogService {
  private static final Logger LOGGER = LoggerFactory.getLogger(ActivityLogServiceImpl.class);

  private final LocalLogService localLogService;

  @Override
  public void log(String action, Long userId, Map<String, Object> extraPayload) {
    Map<String, Object> payload = new LinkedHashMap<>();
    if (extraPayload != null && !extraPayload.isEmpty()) {
      payload.putAll(extraPayload);
    }
    try {
      localLogService.appendLog(action, userId, payload);
    } catch (Exception ex) {
      LOGGER.warn("activity log save failed: action={}, userId={}", action, userId, ex);
    }
  }
}
