package com.tche.blog.model.audit;

import java.time.LocalDateTime;

public interface CreateTimeAware {
  LocalDateTime getCreatedAt();
  void setCreatedAt(LocalDateTime createdAt);
}
