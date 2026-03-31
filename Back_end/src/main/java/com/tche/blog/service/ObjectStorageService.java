package com.tche.blog.service;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;

import org.springframework.web.multipart.MultipartFile;

import com.tche.blog.model.StorageRecord;

public interface ObjectStorageService {
  StorageRecord saveAvatar(MultipartFile file) throws IOException;
  StorageRecord saveArticleCover(MultipartFile file) throws IOException;
  StorageRecord saveArticleImage(MultipartFile file) throws IOException;
  StorageRecord saveLog(Map<String, Object> payload);
  StorageRecord saveArticleContent(String title, String content);
  StorageRecord saveLogDirectly(byte[] content, String aliyunPath);
  String loadObjectText(String aliyunPath);
  void deleteObject(String aliyunPathOrPublicUrl);
  Path resolvePath(String folder, String fileName);
}
