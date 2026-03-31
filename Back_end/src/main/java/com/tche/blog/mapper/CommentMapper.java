package com.tche.blog.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tche.blog.model.CommentEntity;

public interface CommentMapper extends BaseMapper<CommentEntity> {
  List<CommentEntity> selectByArticleId(@Param("articleId") Long articleId);
}
