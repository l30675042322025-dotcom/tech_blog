package com.tche.blog.service;

import java.util.Map;

public interface ActivityLogService {
  void log(String action, Long userId, Map<String, Object> extraPayload);
}
