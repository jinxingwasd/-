/* =============================================== */
/* 脚本文件：script.js 【性能优化版】 */
/* 优化内容：合并事件、减少DOM创建、优化图片加载 */
/* 保留：所有样式和交互逻辑不变 */
/* =============================================== */

// 1. 初始化 GSAP 插件
gsap.registerPlugin(ScrollTrigger);

// 2. 初始化 Lenis 平滑滚动
const lenis = new Lenis({
    autoRaf: true
});

// 3. 桥接 Lenis 和 ScrollTrigger
ScrollTrigger.scrollerProxy("body", {
    scrollTop(value) {
        return arguments.length ? lenis.scrollTo(value, { immediate: true }) : lenis.scroll;
    },
    getBoundingClientRect() {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
    }
});

ScrollTrigger.defaults({ scroller: "body" });

// 4. Lenis 和 ScrollTrigger 同步
gsap.ticker.add((time) => { lenis.raf(time * 1000); });
gsap.ticker.lagSmoothing(0);

// 启动 Lenis 滚动循环
let updateScrollCallback = null;
function raf(time) {
    lenis.raf(time);
    if (updateScrollCallback) {
        updateScrollCallback();
    }
    requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// 页面加载完成后回到顶部
window.addEventListener('load', () => {
    setTimeout(() => {
        lenis.scrollTo(0, { immediate: true });
    }, 100);
});

// ==============================================
// 【性能优化】合并mousemove监听器
// ==============================================
let mouseX = 0, mouseY = 0;
let cardX = 0, cardY = 0;

// 单一监听器 + passive优化
document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
}, { passive: true });

// 统一的动画更新函数
let animationRunning = true;
function updateEffects() {
    if (!animationRunning) return;
    
    const title = document.querySelector('h1');
    const titlePlane = document.getElementById('titlePlane');
    const floatingCard = document.getElementById('floatingCard');
    
    if (title && !titlePlane) {
        const x = (mouseX - window.innerWidth/2) / 20;
        const y = (mouseY - window.innerHeight/2) / 20;
        title.style.transform = `translate(${x}px,${y}px)`;
    }
    
    if (titlePlane) {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const relativeX = mouseX - centerX;
        const relativeY = mouseY - centerY;
        const rotateY = (relativeX / centerX) * 30;
        const rotateX = -(relativeY / centerY) * 30;
        titlePlane.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(50px)`;
    }
    
    if (floatingCard && floatingCard.classList.contains('show')) {
        const ease = 0.15;
        const targetX = mouseX + 180;
        const targetY = mouseY + 115;
        cardX += (targetX - cardX) * ease;
        cardY += (targetY - cardY) * ease;
        const scale = 1;
        floatingCard.style.left = `${cardX}px`;
        floatingCard.style.top = `${cardY}px`;
        floatingCard.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(-15deg)`;
    }
    
    requestAnimationFrame(updateEffects);
}
requestAnimationFrame(updateEffects);

// 5. 页面加载动画
const tl = gsap.timeline();
tl.from("nav", { y: -50, opacity: 0, duration: 0.8, ease: "power3.out" })
  .from("h1 > div", { y: 30, opacity: 0, duration: 0.6, stagger: 0.2, ease: "power3.out" })
  .from(".absolute.bottom-10", { y: 30, opacity: 0, duration: 0.6, ease: "power3.out" });

// 6. 横向滚动动画
const scrollContainer = document.querySelector('.horizontal-scroll-container');

function getScrollAmount() {
    return -(scrollContainer.scrollWidth - window.innerWidth);
}

const horizontalTween = gsap.to(scrollContainer, {
    x: getScrollAmount,
    ease: 'none',
    scrollTrigger: {
        trigger: '.horizontal-scroll-wrapper',
        pin: true,
        scrub: 1,
        end: () => "+=" + (scrollContainer.scrollWidth - window.innerWidth),
        invalidateOnRefresh: true,
    }
});

ScrollTrigger.addEventListener("refreshInit", () => {
    gsap.set(scrollContainer, { x: 0 });
});

// 7. 悬浮卡片交互 【保持原有逻辑不变】
const floatingCard = document.getElementById('floatingCard');
const currentImg = floatingCard.querySelector('.current');
const nextImg = floatingCard.querySelector('.next');
const workItems = document.querySelectorAll('.work-item');

workItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
        const newImgSrc = item.getAttribute('data-img');
        
        floatingCard.classList.add('show');
        workItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        if (!currentImg.src) {
            currentImg.src = newImgSrc;
            nextImg.src = newImgSrc;
            nextImg.style.height = '100%';
            return;
        }

        nextImg.src = newImgSrc;
        nextImg.style.transition = 'none';
        nextImg.style.height = '0';
        void nextImg.offsetWidth;

        nextImg.style.transition = 'height 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)';
        nextImg.style.height = '100%';
        currentImg.style.opacity = '0';

        setTimeout(() => {
            currentImg.src = newImgSrc;
            currentImg.style.opacity = '1';
        }, 350);
    });

    item.addEventListener('mouseleave', () => {
        floatingCard.classList.remove('show');
        item.classList.remove('active');
    });
});

// 8. 扑克牌轮播 【保持原有逻辑不变，优化图片加载】
const poker = {
    poker_eles: [],
    transform_datas: [
        "rotate(-10deg)",
        "rotate(-6deg) translate(35%, -12%)",
        "rotate(-2deg) translate(65%, -19%)",
        "rotate(2deg) translate(95%, -26%)",
        "rotate(6deg) translate(125%, -23%)",
    ],
    imgs: [],
    img_index: 5,
    is_animating: false,

    init() {
        this.poker_eles = [...document.getElementsByClassName('poker')];
        this.poker_eles.forEach((ele, index) => {
            ele.nums = index;
        });
        
        // 【优化】先加载前3张图片，其余按需加载
        const preloadCount = 3;
        for (let i = 1; i <= preloadCount; i++) {
            let img = new Image();
            img.src = `cs/photos/photo (${i}).webp`;
            this.imgs.push(img);
        }

        const box = document.getElementById('box');
        if (box) {
            box.addEventListener('click', (e) => this.handleClick(e));
        }
    },

    handleClick(e) {
        if (this.is_animating) return;
        const clickedPoker = e.target.closest('.poker');
        if (!clickedPoker) return;
        
        const maxNums = Math.max(...this.poker_eles.map(ele => ele.nums));
        if (clickedPoker.nums !== maxNums) return;
        
        this.move();
    },

    move() {
        this.is_animating = true;

        this.poker_eles.forEach((ele) => {
            let nums = ele.nums;
            
            if (nums + 1 >= this.poker_eles.length) {
                nums = 0;
                ele.style.transition = "none";
                
                // 【优化】按需加载图片
                if (this.img_index < 10 && !this.imgs[this.img_index]) {
                    let img = new Image();
                    img.src = `cs/photos/photo (${this.img_index + 1}).webp`;
                    this.imgs.push(img);
                }
                
                const imgObj = this.imgs[this.img_index % this.imgs.length];
                if (imgObj && imgObj.src) {
                    ele.querySelector("img").src = imgObj.src;
                }
                this.img_index = (this.img_index + 1) % 10;
                
                void ele.offsetWidth;
                ele.style.transition = "transform 0.3s ease";
            } else {
                nums += 1;
                ele.style.transition = "transform 0.3s ease";
            }
            
            ele.style.zIndex = nums;
            ele.style.transform = this.transform_datas[nums];
            ele.nums = nums;
        });

        setTimeout(() => {
            this.is_animating = false;
        }, 300);
    }
};

// ==============================================
// 9. 背景效果 【优化：减少数量，使用DocumentFragment】
// ==============================================
document.addEventListener('DOMContentLoaded', function() {
    const starsContainer = document.getElementById('starsContainer');
    const meteorContainer = document.getElementById('meteorContainer');
    
    // 【优化】使用DocumentFragment批量创建，减少重排
    function createStars() {
        if (!starsContainer) return;
        
        const fragment = document.createDocumentFragment();
        const starCount = 60; // 从80优化到60
        
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            const size = Math.random() * 3 + 1;
            star.style.width = size + 'px';
            star.style.height = size + 'px';
            star.style.animationDelay = Math.random() * 2 + 's';
            star.style.opacity = Math.random() * 0.5 + 0.3;
            fragment.appendChild(star);
        }
        starsContainer.appendChild(fragment);
    }
    
    // 【优化】延长流星间隔
    function createMeteor() {
        if (!meteorContainer) return;
        
        const meteor = document.createElement('div');
        meteor.className = 'meteor';
        meteor.style.top = Math.random() * 40 + '%';
        meteor.style.left = '-100px';
        meteor.style.animationDelay = Math.random() * 2 + 's';
        meteor.style.animationDuration = (Math.random() * 2 + 2) + 's';
        meteorContainer.appendChild(meteor);
        
        setTimeout(() => {
            if (meteor.parentNode) {
                meteor.remove();
            }
        }, 5000);
    }
    
    createStars();
    
    // 【优化】流星生成间隔从2-5秒改为3-6秒
    setInterval(createMeteor, 3000 + Math.random() * 3000);
    createMeteor();
    
    poker.init();
});

// 10. 作品点击跳转 【保持原有逻辑不变】
document.addEventListener('DOMContentLoaded', function () {
    const workItems = document.querySelectorAll('.work-item');
    workItems.forEach(item => {
        item.addEventListener('click', function () {
            window.location.href = '全部视频.html';
        });
    });
});
