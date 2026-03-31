package com.tche.blog.service;

import java.util.List;

import com.tche.blog.dto.category.CategoryCreateRequest;
import com.tche.blog.dto.category.CategoryDeleteResponse;
import com.tche.blog.dto.category.CategorySummaryResponse;
import com.tche.blog.model.UserEntity;

public interface CategoryService {
  List<CategorySummaryResponse> listCategories(String keyword);
  CategorySummaryResponse createCategory(CategoryCreateRequest request, UserEntity user);
  CategoryDeleteResponse deleteCategory(Long categoryId, UserEntity user);
  void ensureCategoryExists(String categoryName);
}
