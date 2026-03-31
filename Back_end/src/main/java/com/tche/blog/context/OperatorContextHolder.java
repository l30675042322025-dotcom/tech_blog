package com.tche.blog.context;

public final class OperatorContextHolder {
  private static final ThreadLocal<OperatorInfo> HOLDER = new ThreadLocal<>();

  private OperatorContextHolder() {}

  public static void set(OperatorInfo operatorInfo) {
    HOLDER.set(operatorInfo);
  }

  public static OperatorInfo get() {
    return HOLDER.get();
  }

  public static void clear() {
    HOLDER.remove();
  }
}
