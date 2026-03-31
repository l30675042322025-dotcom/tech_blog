package com.tche.blog.service;

import java.util.List;

import org.springframework.web.multipart.MultipartFile;

import com.tche.blog.dto.essay.EssayDetailResponse;
import com.tche.blog.dto.essay.EssayImageUploadResponse;
import com.tche.blog.dto.essay.EssayLocationResponse;
import com.tche.blog.dto.essay.EssaySummaryResponse;
import com.tche.blog.dto.essay.EssayUpdateRequest;
import com.tche.blog.model.UserEntity;

public interface EssayService {
  List<EssaySummaryResponse> listLatestAdminEssays(int limit);
  List<EssaySummaryResponse> listMyAdminEssays(UserEntity user);
  EssayDetailResponse getEssay(Long essayId);
  EssayDetailResponse createEssay(EssayUpdateRequest request, UserEntity user);
  EssayDetailResponse updateEssay(Long essayId, EssayUpdateRequest request, UserEntity user);
  void deleteEssay(Long essayId, UserEntity user);
  EssayImageUploadResponse uploadEssayImage(MultipartFile file, UserEntity user);
  EssayLocationResponse reverseGeocode(double latitude, double longitude, UserEntity user);
  EssaySummaryResponse getNextLatestEssayExcluding(Long currentEssayId);
}
