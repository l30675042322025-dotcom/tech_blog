/**
 * 顶部导航栏道路小汽车动画
 * 让小汽车沿着蜿蜒的道路移动到对应的菜单
 */

(function () {
  'use strict';

  const navCar = document.getElementById('navRoadCar');
  const navItems = document.querySelectorAll('.nav-item');

  if (!navCar || navItems.length === 0) return;

  // 计算菜单在 nav 中的相对位置
  function getNavItemPosition(index) {
    const visibleItems = [];
    navItems.forEach((item, i) => {
      // 跳过隐藏的菜单
      if (item.offsetParent !== null) {
        visibleItems.push({ element: item, originalIndex: i });
      }
    });

    const targetItem = visibleItems.find(m => m.originalIndex === index);
    if (!targetItem) return null;

    const nav = document.querySelector('.site-nav');
    const navRect = nav.getBoundingClientRect();
    const itemRect = targetItem.element.getBoundingClientRect();

    // 计算相对于 nav 的水平位置
    const relativeLeft = itemRect.left - navRect.left + itemRect.width / 2;

    return relativeLeft;
  }

  // 初始化汽车位置到当前激活的菜单
  function initCarPosition() {
    const activeItem = document.querySelector('.nav-item.active');
    if (activeItem) {
      const index = parseInt(activeItem.dataset.nav);
      const position = getNavItemPosition(index);
      if (position !== null) {
        navCar.style.left = position + 'px';
      }
    }
  }

  // 移动汽车到指定菜单
  function moveCarTo(index) {
    const position = getNavItemPosition(index);
    if (position !== null) {
      navCar.style.left = position + 'px';
    }
  }

  // 为每个菜单添加点击事件
  navItems.forEach((item, index) => {
    item.addEventListener('click', (e) => {
      // 移除所有激活状态
      navItems.forEach(ni => ni.classList.remove('active'));
      // 激活当前菜单
      item.classList.add('active');
      // 移动汽车
      moveCarTo(index);
    });
  });

  // 初始化位置
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCarPosition);
  } else {
    initCarPosition();
  }

  // 窗口大小改变时重新计算位置
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const activeItem = document.querySelector('.nav-item.active');
      if (activeItem) {
        const index = parseInt(activeItem.dataset.nav);
        moveCarTo(index);
      }
    }, 100);
  });

  // 监听登录状态变化，重新初始化位置
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(initCarPosition, 100);
    }
  });
})();
