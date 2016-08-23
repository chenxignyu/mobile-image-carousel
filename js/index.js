/**
 *图片滚动效果
 *@author 陈星宇 271173104@qq.com
 *@jQuery or @String box : 滚动列表jQuery对象或者选择器 如：滚动元素为li的外层ul
 *@object config : {
 *    @Number width : 一次滚动宽度，默认为box里面第一个一级子元素宽度[如果子元素宽度不均匀则滚动效果会错乱]
 *    @Number size : 列表长度，默认为box里面所有一级子元素个数[如果size不等于一级子元素个数，则不支持循环滚动]
 *    @Boolean loop : 是否支持循环滚动 默认 true
 *    @Boolean auto : 是否自动滚动,支持自动滚动时必须支持循环滚动，否则设置无效,默认为true
 *    @Number auto_time : 自动轮播一次时间间隔,默认为：3000ms
 *    @Function callback : 滚动完回调函数
 *}
 **/
(function(window, factory) {
    //amd写法
    if (typeof define === 'function' && define.amd) {
        define(['$'], factory);
        //umd 写法 ， 暴露接口
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        //否则暴露给window
        window.ImgScroll = factory(window.Zepto || window.jQuery || $);
    }
})(this, function ($) {

    function ImgScroll(box, config) {
        this.box = $(box); //盒子
        this.config = $.extend({}, config || {});
        this.btn_box = $(this.config.btn_box);
        this.children = this.box.children();
        this.width = this.config.width || this.children.eq(0).width();//一次滚动的宽度
        this.size = this.config.size || this.children.length; //列表长度值
        this.loop = this.config.loop || true; //默认true
        this.auto = this.config.auto || true; //默认循环
        this.auto_time = this.config.auto_time || 3000;
        this.scroll_time = this.config.scroll_time || 1000;//滚动时长
        this.min_left = -this.width * (this.size - 1);//最小left值，注意是负数[不循环情况下的值]
        this.max_left = 0;//最大lfet值[不循环情况下的值]
        this.now_left = 0;//初始位置信息[不循环情况下的值]
        this.point_x = null;//记录一个x坐标
        this.point_y = null;//记录一个y坐标
        this.start_x = null;//记录一个x坐标
        this.start_y = null;//记录一个y坐标
        this.move_left = false;//记录向哪边滑动
        this.index = this.config.index || 0; //索引值
        this.lock = false;  //锁定
        this.timer = null;  //定时器
        this.move_size_init = 0;  //用来判断滚动距离
        this.min_move_size = this.config.min_move_size || 50; //用来判断最小滚动距离
        this.init(); //初始化
    }

    //初始化
    ImgScroll.prototype.init = function () {
        //index < 0 就 = 0 ， > this.size 就 = this.size
        this.index = this.index < 0 ? 0 : this.index;
        this.index = this.index > this.size ? this.size : this.index;

        this.btnInit();  //按钮初始化
        this.init_loop();  //循环滚动初始化
        this.bindEvent();  //绑定事件
        this.auto_scroll();  //自动滚动
    };

    /*
     初始化循环滚动,当一次性需要滚动多个子元素时，暂不支持循环滚动效果,
     如果想实现一次性滚动多个子元素效果，可以通过页面结构实现
     循环滚动思路：复制首尾节点到尾首
     */
    ImgScroll.prototype.init_loop = function () {
        //暂时只支持size和子节点数相等情况的循环
        if (this.children.length == this.size && this.loop) {
            this.now_left = -this.width * (this.index + 1);//设置初始位置信息 ，负一个元素的宽度
            this.move_size_init = -this.width;//设置初始位置信息 ，负一个元素的宽度
            this.min_left = -this.width * this.size; //最小left值
            this.max_left = -this.width;  //最大left值
            var $first_ele = this.children.eq(0).clone(); //复制第一个原素
            var $last_ele = this.children.eq(this.size - 1).clone(); //复制最后一个原素
            this.box.prepend($last_ele).append($first_ele).css(this.get_style(2));
            this.box.css('width', this.width * (this.size + 2));
        }else{
            this.loop = false;
            this.box.css('width', this.width * this.size);
        }
    };

    //绑定事件
    ImgScroll.prototype.bindEvent = function () {
        var self = this;
        self.box.bind('touchstart', function (e) {
            if (e.touches.length == 1 && !self.lock) {
                clearInterval(self.timer);
                self.point_x = self.start_x = e.touches[0].screenX;
                self.point_y = self.start_y = e.touches[0].screenY;
            }
        }).bind('touchmove', function (e) {
            if (e.touches.length == 1 && !self.lock) {
                return self.move(e.touches[0].screenX, e.touches[0].screenY); //这里根据返回值觉得是否阻止默认touch事件
            }
        }).bind('touchend', function (e) {
            !self.lock && self.move_end()
        });
    };

    //滑动屏幕处理函数
    ImgScroll.prototype.move = function (move_x, move_y) {
        //移动的x值减去 触摸时的 x值

        var changeX = move_x - (this.point_x === null ? move_x : this.point_x);  //需要判断move_start的值？
        //移动的y值减去 触摸时的 y值
        var changeY = move_y - (this.point_y === null ? move_y : this.point_y);
        var marginleft = this.now_left,
            notPreventDefault = false,
            sin = changeY / Math.sqrt(changeX * changeX + changeY * changeY);

        this.now_left = marginleft + changeX;  //现在的位置
        this.move_left = move_x - this.start_x < 0;  //是否向左移动
        if (sin > Math.sin(Math.PI / 3) || sin < -Math.sin(Math.PI / 3)) {//滑动屏幕角度范围：PI/3  -- 2PI/3
            notPreventDefault = true;  //不阻止默认行为
        }
        this.point_x = move_x;
        this.point_y = move_y;
        this.box.css(this.get_style(2));
        return notPreventDefault;
    };

    //滑动屏幕结束处理函数
    ImgScroll.prototype.move_end = function () {

        var changeX = this.now_left % this.width,
            index,
            animation;

        //判断最小的移动距离 ， 不符合就回到原位
        if(this.move_left && this.now_left > this.move_size_init - this.min_move_size){
            this.now_left = this.move_size_init;
            index = this.index;
            //判断是否使用动画滚动
            animation = 'animation';
            //判断最小的移动距离 ， 不符合就回到原位
        }else if( !this.move_left && this.now_left < this.move_size_init + this.min_move_size){
            this.now_left = this.move_size_init;
            index = this.index;
            //判断是否使用动画滚动
            animation = 'animation';
        }else{
            if (this.now_left < this.min_left) {//手指向左滑动
                index = this.index + 1;
            } else if (this.now_left > this.max_left) { //手指向右滑动
                index = this.index - 1;
            } else if (changeX != 0) {
                if (this.move_left) {//手指向左滑动
                    index = this.index + 1;
                } else {//手指向右滑动
                    index = this.index - 1;
                }
            } else {
                index = this.index;
            }
        }

        //触摸结束point_x ， point_x 清空
        this.point_x = this.point_y = null;

        //去到当前索引页
        this.go_index(index, animation);

    };

    //滚动到指定索引页面
    ImgScroll.prototype.go_index = function (index, animation) {
        var self = this;
        if (self.lock) return;
        //锁定
        self.lock = true;
        //清除定时器
        clearInterval(self.timer);

        //如果循环
        if (self.loop) {
            index = index < 0 ? -1 : index;
            index = index > self.size ? self.size : index;
        } else {
            index = index < 0 ? 0 : index;
            index = index >= self.size ? (self.size - 1) : index;
        }

        //如果不循环 ， 并且当前的left值 = -(self.width * index)
        if (!self.loop && (self.now_left == -(self.width * index))) {
            //使用动画滚动
            self.complete(index, animation);
        } else if (self.loop && (self.now_left == -self.width * (index + 1))) {
            //如果循环 ， 并且当前的left值 = -self.width * (index + 1)
            //使用动画滚动
            self.complete(index, animation);
        } else {
            //判断循环滚动边界
            var left ;
            if (index == -1 || index == self.size) {
                self.index = index == -1 ? (self.size - 1) : 0;
                left = index == -1 ? 0 : -self.width * (self.size + 1);
                self.now_left = left;
                self.move_size_init = left;
            } else {
                self.index = index;
                left = -(self.width * (self.index + (self.loop ? 1 : 0)));
                self.now_left = left;
                self.move_size_init = left;
            }

            //设置css3样式
            self.box.css(this.get_style(1));

            setTimeout(function () {
                self.complete(index)
            }, this.scroll_time);  //动画完成的毫秒数，才执行回调
        }
    };


    //下一页滚动
    ImgScroll.prototype.next = function () {
        if (!this.lock) {
            this.go_index(this.index + 1);
        }
    };

    //上一页滚动
    ImgScroll.prototype.prev = function () {
        if (!this.lock) {
            this.go_index(this.index - 1);
        }
    };

    //动画完成回调
    ImgScroll.prototype.complete = function (index, animation) {
        var self = this;
        //锁定
        self.lock = false;
        //执行参数里边的回调函数
        self.config.callback && self.config.callback(self);
        //当前索引按钮高亮
        self.btnActive();

        //判断是否是第一个元素 , 回到最小left值
        if (index == -1) {
            self.now_left = self.min_left;
            self.move_size_init = self.min_left;
        } else if (index == self.size) {
            //判断是否是最后一个元素 , 回到最大left值
            self.now_left = self.max_left;
            self.move_size_init = self.max_left;
        }

        //判断是否使用动画滚动
        var num = animation? 1 : 2;
        //设置css3样式
        self.box.css(this.get_style(num));
        //自动滚动
        self.auto_scroll();
    };

    //按钮初始化
    ImgScroll.prototype.btnInit = function(){
        var self = this;
        var html = '';
        var div = '';
        for(var i = 0, len = self.size ; i < len; i++){
            if(self.index == i){
                div = '<div class="item-btn active"></div>'
            }else{
                div = '<div class="item-btn"></div>'
            }
            html += div;
        }
        self.btn_box.html(html);
    };

    //按钮高亮
    ImgScroll.prototype.btnActive = function(){
        this.btn_box.children().eq(this.index).addClass('active').siblings().removeClass('active');
    };

    //自动播放
    ImgScroll.prototype.auto_scroll = function () {
        var self = this;
        if (!self.loop || !self.auto) return;
        self.timer = setInterval(function () {
            self.go_index(self.index + 1);
        }, self.auto_time);
    };

    /*
     获取动画样式，要兼容更多浏览器，可以扩展该方法
     @int fig : 1 动画 2  没动画
     */
    ImgScroll.prototype.get_style = function (fig) {
        if (fig == 1) {
        }
        var x = this.now_left,
            time = fig == 1 ? this.scroll_time : 0;
        return {
            '-webkit-transition': '-webkit-transform ' + time + 'ms ease',
            '-webkit-transform': 'translate3d(' + x + 'px,0,0)',
            '-webkit-backface-visibility': 'hidden',
            'transition': 'transform ' + time + 'ms ease',
            'transform': 'translate3d(' + x + 'px,0,0)'
        };
    };

    return ImgScroll;
});