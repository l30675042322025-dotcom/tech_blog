package com.tche.blog.mapper;

import java.util.Optional;

import org.apache.ibatis.annotations.Param;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tche.blog.model.UserEntity;

public interface UserMapper extends BaseMapper<UserEntity> {
  Optional<UserEntity> selectByAccount(@Param("account") String account);

  Optional<UserEntity> selectByUsername(@Param("username") String username);
}
