package com.tche.blog.model.audit;

import java.time.LocalDateTime;

public interface UpdateTimeAware {
  LocalDateTime getUpdatedAt();
  void setUpdatedAt(LocalDateTime updatedAt);
}
