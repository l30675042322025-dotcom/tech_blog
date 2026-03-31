package com.tche.blog.service.impl;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.tche.blog.aop.TrackOperation;
import com.tche.blog.common.BusinessException;
import com.tche.blog.dto.category.CategoryCreateRequest;
import com.tche.blog.dto.category.CategoryDeleteResponse;
import com.tche.blog.dto.category.CategorySummaryResponse;
import com.tche.blog.mapper.ArticleMapper;
import com.tche.blog.mapper.CategoryMapper;
import com.tche.blog.model.ArticleEntity;
import com.tche.blog.model.CategoryEntity;
import com.tche.blog.model.UserEntity;
import com.tche.blog.service.ActivityLogService;
import com.tche.blog.service.CategoryService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {
  private static final String ADMIN_USERNAME = "admin";
  private static final String DEFAULT_CATEGORY_NAME = "未分类";

  private final ArticleMapper articleMapper;
  private final CategoryMapper categoryMapper;
  private final ActivityLogService activityLogService;

  @Override
  public List<CategorySummaryResponse> listCategories(String keyword) {
    String normalizedKeyword = keyword == null ? "" : keyword.trim();
    return categoryMapper.selectCategorySummaries(normalizedKeyword.isBlank() ? null : normalizedKeyword);
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  @TrackOperation(name = "category_create", target = "category")
  public CategorySummaryResponse createCategory(CategoryCreateRequest request, UserEntity user) {
    ensureAdmin(user);

    String categoryName = normalizeCategoryName(request.name());
    long exists = categoryMapper.selectCount(new LambdaQueryWrapper<CategoryEntity>().eq(CategoryEntity::getName, categoryName));
    if (exists > 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "category already exists");
    }

    CategoryEntity categoryEntity = new CategoryEntity();
    categoryEntity.setName(categoryName);
    categoryMapper.insert(categoryEntity);

    activityLogService.log("category_create", user.getId(), Map.of("categoryId", categoryEntity.getId(), "name", categoryName));
    return new CategorySummaryResponse(categoryEntity.getId(), categoryName, 0);
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  @TrackOperation(name = "category_delete", target = "category")
  public CategoryDeleteResponse deleteCategory(Long categoryId, UserEntity user) {
    ensureAdmin(user);
    if (categoryId == null || categoryId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "category id is required");
    }

    CategoryEntity categoryEntity = categoryMapper.selectById(categoryId);
    if (categoryEntity == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "category not found");
    }

    String categoryName = normalizeCategoryName(categoryEntity.getName());
    if (DEFAULT_CATEGORY_NAME.equalsIgnoreCase(categoryName)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "default category cannot be deleted");
    }

    ensureCategoryExists(DEFAULT_CATEGORY_NAME);
    int movedArticleCount = articleMapper.update(
      null,
      new LambdaUpdateWrapper<ArticleEntity>()
        .eq(ArticleEntity::getCategory, categoryName)
        .set(ArticleEntity::getCategory, DEFAULT_CATEGORY_NAME)
    );

    categoryMapper.deleteById(categoryId);
    activityLogService.log(
      "category_delete",
      user.getId(),
      Map.of(
        "categoryId",
        categoryId,
        "name",
        categoryName,
        "movedArticleCount",
        movedArticleCount,
        "targetCategoryName",
        DEFAULT_CATEGORY_NAME
      )
    );

    return new CategoryDeleteResponse(categoryId, categoryName, movedArticleCount, DEFAULT_CATEGORY_NAME);
  }

  @Override
  public void ensureCategoryExists(String categoryName) {
    String normalizedCategoryName = normalizeCategoryName(categoryName);
    long exists = categoryMapper.selectCount(
      new LambdaQueryWrapper<CategoryEntity>().eq(CategoryEntity::getName, normalizedCategoryName)
    );
    if (exists > 0) {
      return;
    }

    CategoryEntity categoryEntity = new CategoryEntity();
    categoryEntity.setName(normalizedCategoryName);
    categoryMapper.insert(categoryEntity);
  }

  private String normalizeCategoryName(String value) {
    String normalized = value == null ? "" : value.trim();
    return normalized.isBlank() ? "未分类" : normalized;
  }

  private void ensureAdmin(UserEntity user) {
    if (user == null || user.getUsername() == null || !ADMIN_USERNAME.equalsIgnoreCase(user.getUsername().trim())) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "only admin can manage categories");
    }
  }
}
