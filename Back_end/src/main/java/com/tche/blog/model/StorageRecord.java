package com.tche.blog.model;

import java.time.LocalDateTime;

public record StorageRecord(
  ObjectType type,
  String objectKey,
  String aliyunPath,
  String fileName,
  String dateKey,
  int index,
  String publicUrl,
  LocalDateTime createdAt
) {}
