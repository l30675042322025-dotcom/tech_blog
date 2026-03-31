package com.tche.blog.controller;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.tche.blog.common.ApiResponse;
import com.tche.blog.dto.essay.EssayDetailResponse;
import com.tche.blog.dto.essay.EssayImageUploadResponse;
import com.tche.blog.dto.essay.EssayLocationResponse;
import com.tche.blog.dto.essay.EssaySummaryResponse;
import com.tche.blog.dto.essay.EssayUpdateRequest;
import com.tche.blog.model.UserEntity;
import com.tche.blog.service.AuthService;
import com.tche.blog.service.EssayService;

import jakarta.annotation.Resource;
import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/essays")
public class EssayController {
  @Resource
  private EssayService essayService;

  @Resource
  private AuthService authService;

  @GetMapping("/latest")
  public ApiResponse<List<EssaySummaryResponse>> latest(
    @RequestParam(value = "limit", required = false, defaultValue = "5") int limit
  ) {
    return ApiResponse.ok(essayService.listLatestAdminEssays(limit));
  }

  @GetMapping("/mine")
  public ApiResponse<List<EssaySummaryResponse>> mine(
    @RequestHeader(value = "Authorization", required = false) String authorization
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(essayService.listMyAdminEssays(user));
  }

  @GetMapping("/{essayId}")
  public ApiResponse<EssayDetailResponse> getEssay(@PathVariable Long essayId) {
    return ApiResponse.ok(essayService.getEssay(essayId));
  }

  @GetMapping("/location/reverse")
  public ApiResponse<EssayLocationResponse> reverseGeocode(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @RequestParam("lat") double latitude,
    @RequestParam("lng") double longitude
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(essayService.reverseGeocode(latitude, longitude, user));
  }

  @PostMapping(value = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ApiResponse<EssayImageUploadResponse> uploadImage(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @RequestParam("file") MultipartFile file
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(essayService.uploadEssayImage(file, user));
  }

  @PostMapping
  public ApiResponse<EssayDetailResponse> createEssay(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @Valid @RequestBody EssayUpdateRequest request
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(essayService.createEssay(request, user));
  }

  @PutMapping("/{essayId}")
  public ApiResponse<EssayDetailResponse> updateEssay(
    @PathVariable Long essayId,
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @Valid @RequestBody EssayUpdateRequest request
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(essayService.updateEssay(essayId, request, user));
  }

  @DeleteMapping("/{essayId}")
  public ApiResponse<Object> deleteEssay(
    @PathVariable Long essayId,
    @RequestHeader(value = "Authorization", required = false) String authorization
  ) {
    UserEntity user = authService.requireUser(authorization);
    essayService.deleteEssay(essayId, user);
    return ApiResponse.ok("随笔已删除", null);
  }

  @GetMapping("/next")
  public ApiResponse<EssaySummaryResponse> getNextLatestEssay(
    @RequestParam("currentId") Long currentEssayId
  ) {
    return ApiResponse.ok(essayService.getNextLatestEssayExcluding(currentEssayId));
  }
}
