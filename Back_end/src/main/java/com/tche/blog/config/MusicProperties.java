package com.tche.blog.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Data;

@Data
@Component
@ConfigurationProperties(prefix = "music")
public class MusicProperties {
  private boolean enabled = true;
  private String localRoot = "../Songs";
  private int maxTracks = 300;
}
