package com.tche.blog.controller;

import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.tche.blog.common.ApiResponse;
import com.tche.blog.dto.UserView;
import com.tche.blog.dto.profile.AvatarUploadResponse;
import com.tche.blog.dto.profile.ProfileUpdateRequest;
import com.tche.blog.model.UserEntity;
import com.tche.blog.service.AuthService;
import com.tche.blog.service.ProfileService;

import jakarta.annotation.Resource;
import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/profile")
public class ProfileController {
  @Resource
  private AuthService authService;

  @Resource
  private ProfileService profileService;

  @GetMapping
  public ApiResponse<UserView> getProfile(
    @RequestHeader(value = "Authorization", required = false) String authorization
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(profileService.getProfile(user));
  }

  @PutMapping
  public ApiResponse<UserView> updateProfile(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @Valid @RequestBody ProfileUpdateRequest request
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(profileService.updateProfile(user, request));
  }

  @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ApiResponse<AvatarUploadResponse> uploadAvatar(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @RequestParam("file") MultipartFile file
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(profileService.uploadAvatar(user, file));
  }
}
