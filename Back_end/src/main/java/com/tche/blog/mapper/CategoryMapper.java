package com.tche.blog.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tche.blog.dto.category.CategorySummaryResponse;
import com.tche.blog.model.CategoryEntity;

public interface CategoryMapper extends BaseMapper<CategoryEntity> {
  List<CategorySummaryResponse> selectCategorySummaries(@Param("keyword") String keyword);
}
