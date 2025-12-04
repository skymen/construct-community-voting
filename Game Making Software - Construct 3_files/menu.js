"use strict";

(function () {

    var mobileMenuCheckboxes;
    var mobileMenuOpener;
    var mobileMenuContent;
    var notificationPopMenu, accountPopMenu;
    var notificationsLoaded = false;
    var bellIconWrap, accountMenuWrap;
    var additionalSubMenuCheck;

    window.C3Web.TopMenu = {

        initialise: function () {

            additionalSubMenuCheck = document.getElementById("AdditionalSubMenu");
            if (additionalSubMenuCheck) {
                additionalSubMenuCheck.addEventListener("change",
                    function() {
                        C3Web.TopMenu.additionalSubMenuCheckboxChanged();
                    });
            }

            // Show notification loader
            var notificationLoader = document.getElementById("NotificationLoader");
            if (notificationLoader) {
                notificationLoader.style.display = "flex";
            }

            // Continue to highlight top menu lis when popup showing
            const topLevelLis = document.querySelectorAll("ul.newTopMenu > li");
            for (let i = 1; i < topLevelLis.length - 1; i++) {
                const listItem = topLevelLis[i];
                listItem.addEventListener("mouseenter", function () {
                    this.classList.add("hovered");
                });
                listItem.addEventListener("mouseleave", function () {
                    this.classList.remove("hovered");
                });
            }

            // Hover account menu drop downs don't show if mobile menu showing
            notificationPopMenu = document.getElementById("NotificationPopMenu");
            accountPopMenu = document.getElementById("AccountPopMenu");

            // Auto close mobile menu
            document.addEventListener('mouseup', function (e) {
                // Sync with @media screen and (max-width: 1000px)
                if (window.innerWidth <= 1000) {
                    const container = document.getElementById("TopMenuMobilePop");
                    if (container && !container.contains(e.target)) {
                        mobileMenuOpener.checked = false;
                        C3Web.TopMenu.mobileMenuClosed();
                    }
                }
            });

            // Show hide mobile menu when resize window
            if (mobileMenuOpener) {
                window.addEventListener('resize',
                    function() {

                        mobileMenuOpener.checked = false;
                        C3Web.TopMenu.mobileMenuClosed();
                        if (additionalSubMenuCheck) {
                            additionalSubMenuCheck.checked = false;
                            C3Web.TopMenu.additionalSubMenuCheckboxChanged();
                        }

                    },
                    true);
            }

            // Mobile menu hide show
            mobileMenuCheckboxes = document.querySelectorAll(".mobileMenuContent > ul > li > input[type=checkbox]");
            for (let i = 0; i < mobileMenuCheckboxes.length; i++) {
                const mobileMenuCheckbox = mobileMenuCheckboxes[i];
                mobileMenuCheckbox.addEventListener("change", function() {
                    const id = this.id;
                    for (let c = 0; c < mobileMenuCheckboxes.length; c++) {
                        const selectedCheckbox = mobileMenuCheckboxes[c];
                        if (selectedCheckbox.id !== id) {
                            selectedCheckbox.checked = false;
                        }
                    }
                    C3Web.TopMenu.mobileMenuScrollTo(this.parentNode);
                });
            }

            // Scroll to selected mobile menu item
            mobileMenuContent = document.getElementById("MobileMenuContent");
            mobileMenuOpener = document.getElementById("MobileMenuChecker");
            if (mobileMenuOpener) {
                mobileMenuOpener.addEventListener("change",
                    function() {
                        if (this.checked) C3Web.TopMenu.mobileMenuOpened();
                        else C3Web.TopMenu.mobileMenuClosed();
                    });
                if (mobileMenuOpener.checked) C3Web.TopMenu.mobileMenuOpened();
                else C3Web.TopMenu.mobileMenuClosed();
            }

            // Level 2 mobile menu opened
            // Prevent double scroll bars
            if (mobileMenuContent) {
                const subMenuCheckboxes = mobileMenuContent.querySelectorAll(".subMenu2Check");
                for (let i = 0; i < subMenuCheckboxes.length; i++) {
                    const checkbox = subMenuCheckboxes[i];
                    checkbox.addEventListener("change",
                        function() {

                            const contentWrap = document.getElementById("MobileMenuContentWrap");
                            if (this.checked) {
                                contentWrap.classList.add("level2Opened");
                            } else {
                                contentWrap.classList.remove("level2Opened");
                            }
                        }
                    );
                }
            }

            // Product grid selector
            const productGridSelectorLinks = document.querySelectorAll("#ProductGridContentSelector li");
            for (let i = 0; i < productGridSelectorLinks.length; i++) {
                const listItem = productGridSelectorLinks[i];
                listItem.addEventListener("mouseleave", function () {
                    const thisLi = this;
                    thisLi.classList.remove("selected");
                    const gridContentWrapperID = thisLi.getAttribute("data-grid-content-wrap-id");
                    const gridContents = document.getElementById(gridContentWrapperID).querySelectorAll("ul.gridMenu");
                    for (let g = 0; g < gridContents.length; g++) {
                        const gridContent = gridContents[g];
                        const dataListItem = document.getElementById(gridContent.getAttribute("data-grid-li-id"));
                        const topVal = getComputedStyle(gridContent).top.replace("px", "").split(".")[0];
                        if (topVal < 150) {
                            dataListItem.classList.add("selected");
                            gridContent.style.top = "0";
                            gridContent.style.opacity = "1";
                        } else {
                            dataListItem.classList.remove("selected");
                        }
                    }
                });
                listItem.addEventListener("mouseenter", function () {
                    const thisLi = this;
                    thisLi.parentNode.classList.add("selected");
                    const links = thisLi.parentNode.parentNode.querySelectorAll("li");
                    for (let g = 0; g < links.length; g++) {
                        links[g].classList.remove("selected");
                    }
                    const gridContentID = thisLi.getAttribute("data-grid-content-id");
                    const gridContentWrapperID = thisLi.getAttribute("data-grid-content-wrap-id");
                    const gridContents = document.getElementById(gridContentWrapperID).querySelectorAll("ul.gridMenu");
                    for (let g = 0; g < gridContents.length; g++) {
                        gridContents[g].style.top = "100%";
                        gridContents[g].style.opacity = "0";
                    }
                    const content = document.getElementById(gridContentID);
                    content.style.top = "0";
                    content.style.opacity = "1";
                });
            }

            // Bell icon/account 
            bellIconWrap = document.getElementById("BellIcoWrap");
            accountMenuWrap = document.getElementById("AccountMenuWrap");

            if (additionalSubMenuCheck && bellIconWrap && accountMenuWrap) {
                bellIconWrap.addEventListener("click",
                    function () {
                        additionalSubMenuCheck.checked = false;
                        C3Web.TopMenu.additionalSubMenuCheckboxChanged();
                    }
                );
                bellIconWrap.addEventListener("mouseenter",
                    function () {
                        additionalSubMenuCheck.checked = false;
                        C3Web.TopMenu.additionalSubMenuCheckboxChanged();
                    }
                );
                accountMenuWrap.addEventListener("click",
                    function () {
                        additionalSubMenuCheck.checked = false;
                        C3Web.TopMenu.additionalSubMenuCheckboxChanged();
                    }
                );
                accountMenuWrap.addEventListener("mouseenter",
                    function () {
                        additionalSubMenuCheck.checked = false;
                        C3Web.TopMenu.additionalSubMenuCheckboxChanged();
                    }
                );
            }

            // Mark as unread
            const markAsUnreadLink = document.getElementById("MarkAllNotificationsAsRead");
            if (markAsUnreadLink) {
                var unread = parseInt(markAsUnreadLink.getAttribute("data-unread"));
                if (unread > 0) {
                    markAsUnreadLink.style.display = "block";
                    markAsUnreadLink.addEventListener("click",
                        function(e) {
                            e.preventDefault();

                            fetch("/handlers/notifications/markunread.json");

                            // Remove unread style
                            const lis = document.querySelectorAll("#NotificationLoader li");
                            for (let i = 0; i < lis.length; i++) {
                                lis[i].classList.remove("unread");
                            }

                            // Hide mark all as read
                            markAsUnreadLink.style.display = "none";

                            // Show proper header
                            document.getElementById("NotificationsTitleWrap").innerText = "You're all up to date!";

                            // Change bell icon
                            const bellIcon = bellIconWrap.querySelector("img");
                            bellIcon.classList.remove("unreadNotifications");
                            var newBellIconImage = "";
                            const bellIconPathSplit = bellIcon.getAttribute("src").split("/");
                            for (let i = 0; i < bellIconPathSplit.length - 1; i++) {
                                newBellIconImage += bellIconPathSplit[i] + "/";
                            }
                            newBellIconImage += "bell.svg";
                            bellIcon.setAttribute("src", newBellIconImage);
                        });
                }
            }

            // Notifications hover
            const topMenuNotificationsListItem = document.getElementById("TopMenuNotificationsWrap");
            if (topMenuNotificationsListItem) {
                topMenuNotificationsListItem.addEventListener("mouseenter", function () {
                    
                    // Prevent multiple requests
                    if(notificationsLoaded) return;
                    notificationsLoaded = true;

                    fetch("/handlers/notifications/get.json")
                        .then(response => response.json())
                        .then(data => {

                            const popupContent = document.getElementById("NotificationLoader");
                            popupContent.classList.add("loaded");
                            popupContent.replaceChildren();

                            // Failed, probably not logged in
                            if (data.success === false) {

                                var newLi = document.createElement("li");
                                newLi.innerHTML = "<span class=\"noJsNotifications\">Failed to load your notifications.  Please refresh this page.</span>";
                                popupContent.appendChild(newLi);

                            } else {

                                var lastRead = new Date(data.lastRead);
                                var notifications = data.notifications;

                                for (var n = 0; n < notifications.length; n++) {

                                    var notification = notifications[n];
                                    var notificationDate = new Date(notification.unixDate);
                                    var unread = lastRead <= notificationDate;
                                    var li = document.createElement("li");
                                    if (notification.relatedObjectID) {
                                        li.setAttribute("data-related-object-id", notification.relatedObjectID);
                                    }
                                    if (notification.relatedObjectTypeID) {
                                        li.setAttribute("data-object-disabled-object-type", notification.relatedObjectTypeID);
                                    }
                                    li.setAttribute("data-notification-id", notification.id);
                                    li.setAttribute("data-type-id", notification.typeID);
                                    if (notification.disabledType) {
                                        li.setAttribute("data-disabled-type", "1");
                                    } else {
                                        li.setAttribute("data-disabled-type", "0");
                                    }

                                    if (notification.canDisableForObject) {
                                        li.setAttribute("data-can-disable-object", "1");
                                    } else {
                                        li.setAttribute("data-can-disable-object", "0");
                                    }
                                    if (notification.isDisabledObject) {
                                        li.setAttribute("data-object-disabled", "1");
                                    } else {
                                        li.setAttribute("data-object-disabled", "0");
                                    }

                                    if (notification.skip) {
                                        li.style.display = "none";
                                    }
                                    if (unread) {
                                        li.classList.add("unread");
                                    }

                                    var target = " target=\"_blank\" ";
                                    if (!notification.newWindow) {
                                        target = "";
                                    }

                                    var url = notification.finalURL;
                                    var anchorOpen = "<a href=\"" + url + "\" " + target + ">";
                                    var anchorClose = "</a>";
                                    if (url === "") {
                                        anchorOpen = "";
                                        anchorClose = "";
                                    }

                                    var iconClass = "";
                                    if (notification.animatedIcon) {
                                        iconClass = " class=\"animated\" ";
                                    }

                                    var parentCat = "";
                                    if (notification.parentCategory) {
                                        parentCat = "<span class=\"parentCat\">" +
                                            notification.parentCategory +
                                            "</span>";
                                    }

                                    var subMenu = "";
                                    if (!notification.hideSubMenu) {
                                        subMenu =
                                            "<a class=\"notificationSubMenu\" href=\"#\"><span></span><span></span><span></span></a>";
                                    }

                                    li.innerHTML =
                                        "<div>" +
                                        "<div class=\"titleContainer\">" +
                                        "<div>" +
                                        anchorOpen + "<img no-referrer=\"none\" " + iconClass + " loading=\"lazy\" src=\"" + notification.iconURL + "\" width=\"48\" height=\"48\">" + anchorClose +
                                        "</div>" +
                                        "<div>" +
                                        "<div class=\"notificationTitle\">" +
                                        parentCat +
                                        anchorOpen + notification.title + anchorClose +
                                        "<div class=\"notificationDate\">" + notification.timeAgo + "</div>" +
                                        "</div>" +
                                        "</div>" +
                                        "<div>" + subMenu + "</div>" +
                                        "</div>" +
                                        "<div class=\"notificationContent\">" + notification.htmlContent + "</p>" +
                                        "</div>" +
                                        "</div>";

                                    popupContent.appendChild(li);
                                }
                            }
                        }
                        );

                });
            }
        },

        mobileMenuClosed: function () {
            // Allow drop downs
            if (notificationPopMenu) {
                notificationPopMenu.style.display = "block";
            }
            if (accountPopMenu) {
                accountPopMenu.style.display = "block";
            }
        },

        mobileMenuOpened: function() {

            if (!mobileMenuOpener.checked) return;

            // Close additional menu
            if (additionalSubMenuCheck) {
                additionalSubMenuCheck.checked = false;
                C3Web.TopMenu.additionalSubMenuCheckboxChanged();
            }

            // Don't allow drop downs
            if (notificationPopMenu) {
                notificationPopMenu.style.display = "none";
            }
            if (accountPopMenu) {
                accountPopMenu.style.display = "none";
            }

            // Scroll to open menu
            for (let i = 0; i < mobileMenuCheckboxes.length; i++) {
                const selectedMenu = mobileMenuCheckboxes[i];
                if (selectedMenu.checked) {
                    const listItem = selectedMenu.parentNode;
                    C3Web.TopMenu.mobileMenuScrollTo(listItem);
                    return;
                }
            }

            // No open menu found, auto select default
            const defaultCheckbox = document.getElementById(mobileMenuContent.getAttribute("data-default-selected"));
            defaultCheckbox.checked = true;
            C3Web.TopMenu.mobileMenuScrollTo(defaultCheckbox.parentNode);
        },

        mobileMenuScrollTo(listItem) {
            const containerTop = mobileMenuContent.offsetTop;
            const scrollPosition = listItem.offsetTop - containerTop;
            const scrollOptions = {
                top: scrollPosition,
                left: 0,
                behavior: "smooth"
            }
            document.getElementById("MobileMenuContentWrap").scroll(scrollOptions);
        },

        additionalSubMenuCheckboxChanged: function () {
            const label = document.getElementById("AdditionalSubMenuLabelControl");
            const firstImage = label.querySelector("img:first-child");
            const downArrow = label.querySelector("img:nth-child(2)");
            if (additionalSubMenuCheck.checked) {
                firstImage.style.display = "none";
                downArrow.style.display = "block";

                // Open sub menus
                const checks = document.querySelectorAll(".additionalSubMenuInner input[type=checkbox]");
                for (let i = 0; i < checks.length; i++) {
                    checks[i].checked = true;
                }

            } else {
                firstImage.style.display = "block";
                downArrow.style.display = "none";
            }
        }

    };

    C3Web.TopMenu.initialise();

})();