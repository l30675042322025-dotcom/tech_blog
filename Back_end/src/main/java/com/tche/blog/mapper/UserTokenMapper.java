package com.tche.blog.mapper;

import java.util.Optional;

import org.apache.ibatis.annotations.Param;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tche.blog.model.UserTokenEntity;

public interface UserTokenMapper extends BaseMapper<UserTokenEntity> {
  Optional<UserTokenEntity> selectValidToken(@Param("token") String token);
}
