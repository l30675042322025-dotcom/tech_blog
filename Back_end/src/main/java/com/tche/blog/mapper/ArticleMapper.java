package com.tche.blog.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tche.blog.model.ArticleEntity;

public interface ArticleMapper extends BaseMapper<ArticleEntity> {
  List<ArticleEntity> selectAllOrderByCreatedAtDesc();

  List<ArticleEntity> selectByAuthorNameOrderByCreatedAtDesc(@Param("authorName") String authorName);
}
