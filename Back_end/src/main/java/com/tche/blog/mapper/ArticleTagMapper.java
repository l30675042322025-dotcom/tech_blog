package com.tche.blog.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tche.blog.model.ArticleTagEntity;

public interface ArticleTagMapper extends BaseMapper<ArticleTagEntity> {
  List<String> selectTagNamesByArticleId(@Param("articleId") Long articleId);
}
