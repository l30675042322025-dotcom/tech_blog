package com.tche.blog.config;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

@Configuration
@MapperScan("com.tche.blog.mapper")
public class MybatisPlusConfig {}
