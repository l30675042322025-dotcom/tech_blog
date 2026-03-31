package com.tche.blog.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Data;

@Data
@Component
@ConfigurationProperties(prefix = "ai.summary")
public class AiSummaryProperties {
  private boolean enabled = false;
  private String baseUrl = "https://open.bigmodel.cn/api/paas/v4";
  private String apiKey = "";
  private String model = "glm-4.7";
  private int connectTimeoutSeconds = 10;
  private int readTimeoutSeconds = 45;
  private int maxInputChars = 6000;
}
