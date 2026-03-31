package com.tche.blog.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Data;

@Data
@Component
@ConfigurationProperties(prefix = "storage")
public class StorageProperties {
  private String localRoot;
  private String publicBaseUrl;
}
