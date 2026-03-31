package com.tche.blog.controller;

import java.time.LocalDateTime;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tche.blog.common.ApiResponse;

@RestController
@RequestMapping("/api")
public class HealthController {
  @GetMapping("/health")
  public ApiResponse<Map<String, Object>> health() {
    return ApiResponse.ok(Map.of("status", "UP", "time", LocalDateTime.now().toString()));
  }
}
