package com.tche.blog.controller;

import java.util.List;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tche.blog.common.ApiResponse;
import com.tche.blog.dto.category.CategoryCreateRequest;
import com.tche.blog.dto.category.CategoryDeleteResponse;
import com.tche.blog.dto.category.CategorySummaryResponse;
import com.tche.blog.model.UserEntity;
import com.tche.blog.service.AuthService;
import com.tche.blog.service.CategoryService;

import jakarta.annotation.Resource;
import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/categories")
public class CategoryController {
  @Resource
  private CategoryService categoryService;

  @Resource
  private AuthService authService;

  @GetMapping
  public ApiResponse<List<CategorySummaryResponse>> listCategories(
    @RequestParam(value = "keyword", required = false) String keyword
  ) {
    return ApiResponse.ok(categoryService.listCategories(keyword));
  }

  @PostMapping
  public ApiResponse<CategorySummaryResponse> createCategory(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @Valid @RequestBody CategoryCreateRequest request
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(categoryService.createCategory(request, user));
  }

  @DeleteMapping("/{categoryId}")
  public ApiResponse<CategoryDeleteResponse> deleteCategory(
    @PathVariable Long categoryId,
    @RequestHeader(value = "Authorization", required = false) String authorization
  ) {
    UserEntity user = authService.requireUser(authorization);
    return ApiResponse.ok(categoryService.deleteCategory(categoryId, user));
  }
}
