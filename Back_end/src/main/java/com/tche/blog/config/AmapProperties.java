package com.tche.blog.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Data;

@Data
@Component
@ConfigurationProperties(prefix = "amap")
public class AmapProperties {
  private boolean enabled = true;
  private String key = "";
  private String reverseGeocodeUrl = "https://restapi.amap.com/v3/geocode/regeo";
  private int connectTimeoutSeconds = 6;
  private int readTimeoutSeconds = 8;
}
