document.addEventListener('DOMContentLoaded', function() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const loginSection = document.getElementById('login-section');
    const commentSection = document.getElementById('comment-section');
    const usernameInput = document.getElementById('login-username');
    let commentInput = document.querySelector('.main-input .cmnt-input');
    let sendButton = document.querySelector('.main-input .bu-primary');
    const commentsWrapper = document.querySelector('.comments-wrp');
    const videoPlayer = document.getElementById('main-video');
    const videoList = document.getElementById('video-list');
    const welcomeMessage = document.getElementById('welcome-message');
    const showCommentBtn = document.getElementById('show-comment-btn');

    let db;
    let currentUser = null;
    let comments = [];

    function setupFirebase() {
        if (window.db) {
            db = window.db;
            init();
        } else {
            document.addEventListener('firebaseLoaded', () => {
                db = window.db;
                init();
            });
        }
    }

    function createPopup(message, type = "info") {
        const popup = document.createElement("div");
        popup.className = `popup ${type}`;
        popup.textContent = message;

        document.body.appendChild(popup);

        setTimeout(() => {
            popup.classList.add("show");

            setTimeout(() => {
                popup.classList.remove("show");
                setTimeout(() => popup.remove(), 300);
            }, 3000);
        }, 100);
    }

    async function fetchComments() {
        try {
            if (!db) {
                console.error("Firebase not initialized");
                return [];
            }

            const commentsSnapshot = await db.collection("comments").get();
            const commentsData = [];

            commentsSnapshot.forEach((doc) => {
                const data = doc.data();
                commentsData.push({
                    _id: doc.id,
                    ...data
                });
            });

            comments = commentsData;
            console.log("Loaded comments:", comments);
            return comments;
        } catch (error) {
            console.error("Error loading comments:", error);
            createPopup("Failed to load comments", "error");
            return [];
        }
    }

    function createCommentNode(comment, index) {
        if (!comment || !comment.text) return null;

        try {
            const commentTemplate = document.querySelector(".comment-template");
            if (!commentTemplate) {
                console.error("Comment template not found");
                return null;
            }

            const commentNode = commentTemplate.content.cloneNode(true);
            const commentElement = commentNode.querySelector(".comment");

            commentElement.dataset.id = `comment-${comment._id || Date.now()}`;

            const usernameElement = commentNode.querySelector(".usr-name");
            if (usernameElement) {
                usernameElement.textContent = comment.username || 'Anonymous';
            }

            let formattedDate = "";
            if (comment.date) {
                if (comment.date.toDate) {
                    formattedDate = comment.date.toDate().toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                    });
                } else if (comment.date.seconds) {
                    formattedDate = new Date(comment.date.seconds * 1000).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                    });
                }
            }

            const timeElement = commentNode.querySelector(".cmnt-at");
            if (timeElement) {
                timeElement.textContent = ""; 
            }

            const contentElement = commentNode.querySelector(".c-body");
            if (contentElement) {
                contentElement.textContent = comment.text;
            }

            if (currentUser && comment.username === currentUser.username) {
                commentElement.classList.add("this-user");

                const editBtn = commentNode.querySelector('.edit');
                const contentElement = commentNode.querySelector('.c-body');
                let isEditing = false;

                editBtn.addEventListener('click', async () => {
                    if (!isEditing) {
                        isEditing = true;
                        const originalText = contentElement.textContent;
                        contentElement.innerHTML = `
                            <textarea class="cmnt-input edit-input">${originalText}</textarea>
                            <div class="edit-actions">
                                <button class="bu-primary save-edit">Save</button>
                                <button class="bu-secondary cancel-edit">Cancel</button>
                            </div>
                        `;
                        editBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';

                        const textarea = contentElement.querySelector('.edit-input');
                        const saveBtn = contentElement.querySelector('.save-edit');
                        const cancelBtn = contentElement.querySelector('.cancel-edit');

                        textarea.focus();

                        const cancelEdit = () => {
                            isEditing = false;
                            contentElement.textContent = originalText;
                            editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
                        };

                        const saveEdit = async () => {
                            const newText = textarea.value.trim();
                            if (!newText) {
                                createPopup("Comment cannot be empty", "error");
                                return;
                            }

                            try {
                                showLoading("Saving changes...");
                                await db.collection("comments").doc(comment._id).update({
                                    text: newText
                                });
                                isEditing = false;
                                contentElement.textContent = newText;
                                editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
                                createPopup("Comment updated successfully", "success");
                            } catch (error) {
                                console.error('Error updating comment:', error);
                                createPopup("Failed to update comment", "error");
                                cancelEdit();
                            } finally {
                                hideLoading();
                            }
                        };

                        saveBtn.addEventListener('click', saveEdit);
                        cancelBtn.addEventListener('click', cancelEdit);

                        textarea.addEventListener('keydown', async (e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                await saveEdit();
                            } else if (e.key === "Escape") {
                                cancelEdit();
                            }
                        });
                    } else {
                        isEditing = false;
                        contentElement.textContent = comment.text;
                        editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
                    }
                });

                const deleteBtn = commentNode.querySelector('.delete');
                deleteBtn.addEventListener('click', async () => {
                    if (confirm("Are you sure you want to delete this comment?")) {
                        try {
                            showLoading("Deleting comment...");
                            await db.collection("comments").doc(comment._id).delete();
                            createPopup("Comment deleted successfully", "success");
                            await displayComments();
                        } catch (error) {
                            console.error('Error deleting comment:', error);
                            createPopup("Failed to delete comment", "error");
                        } finally {
                            hideLoading();
                        }
                    }
                });
            }

            const replyButton = commentNode.querySelector(".reply");
            const repliesSection = commentNode.querySelector(".replies");
            const hideRepliesBtn = commentNode.querySelector(".hide-replies-btn");

            if (replyButton && currentUser) {
                replyButton.addEventListener("click", () => {

                    document.querySelectorAll(".temp-reply-input").forEach(input => {
                        input.remove();
                    });

                    if (!repliesSection) {
                        console.error("Replies section not found in the comment template");
                        return;
                    }

                    const replyInput = document.createElement("div");
                    replyInput.className = "reply-input temp-reply-input";
                    replyInput.innerHTML = `
                        <textarea class="cmnt-input" placeholder="Reply to @${comment.username}...">@${comment.username} </textarea>
                        <button class="bu-primary">SEND</button>
                    `;

                    repliesSection.style.display = "flex";
                    repliesSection.style.opacity = "1";
                    if (hideRepliesBtn) {
                        hideRepliesBtn.style.display = "block";
                        hideRepliesBtn.textContent = "Hide Replies";
                    }

                    repliesSection.insertBefore(replyInput, repliesSection.firstChild);

                    const textarea = replyInput.querySelector(".cmnt-input");
                    const sendBtn = replyInput.querySelector(".bu-primary");

                    textarea.focus();

                    const handleReply = async () => {
                        const replyText = textarea.value.trim();
                        if (!replyText) {
                            createPopup("Please enter a reply", "error");
                            return;
                        }

                        try {
                            showLoading("Posting reply...");
                            const commentRef = db.collection("comments").doc(comment._id);
                            const commentDoc = await commentRef.get();

                            if (!commentDoc.exists) {
                                createPopup("Comment not found", "error");
                                return;
                            }

                            const commentData = commentDoc.data();
                            const replies = commentData.replies || [];

                            replies.push({
                                username: currentUser.username,
                                text: replyText,
                                score: 0,
                                date: firebase.firestore.FieldValue.serverTimestamp() 
                            });

                            await commentRef.update({ replies });
                            createPopup("Reply added successfully", "success");
                            replyInput.remove();
                            await displayComments();
                        } catch (error) {
                            console.error('Error adding reply:', error);
                            createPopup("Failed to add reply", "error");
                        } finally {
                            hideLoading();
                        }
                    };

                    sendBtn.addEventListener("click", handleReply);

                    textarea.addEventListener("keydown", async (e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            await handleReply();
                        }
                    });
                });
            }

            if (comment.replies && comment.replies.length > 0) {
                comment.replies.forEach((reply, replyIndex) => {
                    const replyElement = document.createElement("div");
                    replyElement.className = "comment reply";

                    if (reply.username === currentUser?.username) {
                        replyElement.classList.add("this-user");
                    }

                    let replyDate = "";
                    if (reply.date) {
                        if (reply.date.toDate) {
                            replyDate = reply.date.toDate().toLocaleString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            });
                        } else if (reply.date.seconds) {
                            replyDate = new Date(reply.date.seconds * 1000).toLocaleString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            });
                        }
                    }

                    replyElement.innerHTML = `
                        <div class="c-main">
                            <div class="c-header">
                                <div class="c-header-left">
                                    <div class="usr-name">${reply.username}</div>
                                    ${reply.username === currentUser?.username ? '<div class="this-usr">you</div>' : ''}
                                    <div class="cmnt-at"></div>
                                </div>
                                <div class="c-actions">
                                    ${currentUser ? `<button class="reply"><i class="fas fa-reply"></i> Reply</button>` : ''}
                                    ${reply.username === currentUser?.username ? `
                                        <button class="delete"><i class="fas fa-trash"></i> Delete</button>
                                        <button class="edit"><i class="fas fa-edit"></i> Edit</button>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="c-body">${reply.text}</div>
                        </div>
                    `;

                    if (currentUser) {
                        const replyBtn = replyElement.querySelector('.reply');
                        if (replyBtn) {
                            replyBtn.addEventListener('click', () => {

                                document.querySelectorAll(".temp-reply-input").forEach(input => {
                                    input.remove();
                                });

                                const replyInput = document.createElement("div");
                                replyInput.className = "reply-input temp-reply-input";
                                replyInput.innerHTML = `
                                    <textarea class="cmnt-input" placeholder="Reply to @${reply.username}...">@${reply.username} </textarea>
                                    <button class="bu-primary">SEND</button>
                                `;

                                replyElement.insertAdjacentElement('afterend', replyInput);

                                const textarea = replyInput.querySelector(".cmnt-input");
                                const sendBtn = replyInput.querySelector(".bu-primary");

                                textarea.focus();

                                const handleNestedReply = async () => {
                                    const replyText = textarea.value.trim();
                                    if (!replyText) {
                                        createPopup("Please enter a reply", "error");
                                        return;
                                    }

                                    try {
                                        showLoading("Posting reply...");
                                        const commentRef = db.collection("comments").doc(comment._id);
                                        const commentDoc = await commentRef.get();

                                        if (!commentDoc.exists) {
                                            createPopup("Comment not found", "error");
                                            return;
                                        }

                                        const commentData = commentDoc.data();
                                        const replies = commentData.replies || [];

                                        replies.push({
                                            username: currentUser.username,
                                            text: replyText,
                                            score: 0,
                                            date: firebase.firestore.FieldValue.serverTimestamp() 
                                        });

                                        await commentRef.update({ replies });
                                        createPopup("Reply added successfully", "success");
                                        replyInput.remove();
                                        await displayComments();
                                    } catch (error) {
                                        console.error('Error adding nested reply:', error);
                                        createPopup("Failed to add reply", "error");
                                    } finally {
                                        hideLoading();
                                    }
                                };

                                sendBtn.addEventListener("click", handleNestedReply);

                                textarea.addEventListener("keydown", async (e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        await handleNestedReply();
                                    }
                                });
                            });
                        }
                    }

                    if (currentUser && reply.username === currentUser.username) {
                        const editBtn = replyElement.querySelector('.edit');
                        const contentElement = replyElement.querySelector('.c-body');
                        let isEditing = false;

                        editBtn.addEventListener('click', async () => {
                            if (!isEditing) {
                                isEditing = true;
                                const originalText = contentElement.textContent;
                                contentElement.innerHTML = `
                                    <textarea class="cmnt-input edit-input">${originalText}</textarea>
                                    <div class="edit-actions">
                                        <button class="bu-primary save-edit">Save</button>
                                        <button class="bu-secondary cancel-edit">Cancel</button>
                                    </div>
                                `;
                                editBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';

                                const textarea = contentElement.querySelector('.edit-input');
                                const saveBtn = contentElement.querySelector('.save-edit');
                                const cancelBtn = contentElement.querySelector('.cancel-edit');

                                textarea.focus();

                                const cancelEdit = () => {
                                    isEditing = false;
                                    contentElement.textContent = originalText;
                                    editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
                                };

                                const saveEdit = async () => {
                                    const newText = textarea.value.trim();
                                    if (!newText) {
                                        createPopup("Reply cannot be empty", "error");
                                        return;
                                    }

                                    try {
                                        showLoading("Saving changes...");
                                        const commentRef = db.collection("comments").doc(comment._id);
                                        const commentDoc = await commentRef.get();
                                        if (!commentDoc.exists) {
                                            createPopup("Comment not found", "error");
                                            return;
                                        }

                                        const commentData = commentDoc.data();
                                        const replies = commentData.replies || [];
                                        replies[replyIndex].text = newText;

                                        await commentRef.update({ replies });
                                        isEditing = false;
                                        contentElement.textContent = newText;
                                        editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
                                        createPopup("Reply updated successfully", "success");
                                    } catch (error) {
                                        console.error('Error updating reply:', error);
                                        createPopup("Failed to update reply", "error");
                                        cancelEdit();
                                    } finally {
                                        hideLoading();
                                    }
                                };

                                saveBtn.addEventListener('click', saveEdit);
                                cancelBtn.addEventListener('click', cancelEdit);

                                textarea.addEventListener('keydown', async (e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        await saveEdit();
                                    } else if (e.key === "Escape") {
                                        cancelEdit();
                                    }
                                });
                            } else {
                                isEditing = false;
                                contentElement.textContent = reply.text;
                                editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
                            }
                        });

                        const deleteBtn = replyElement.querySelector('.delete');
                        deleteBtn.addEventListener('click', async () => {
                            if (confirm("Are you sure you want to delete this reply?")) {
                                try {
                                    showLoading("Deleting reply...");
                                    const commentRef = db.collection("comments").doc(comment._id);
                                    const commentDoc = await commentRef.get();
                                    if (!commentDoc.exists) {
                                        createPopup("Comment not found", "error");
                                        return;
                                    }

                                    const commentData = commentDoc.data();
                                    const replies = commentData.replies || [];
                                    replies.splice(replyIndex, 1);

                                    await commentRef.update({ replies });
                                    createPopup("Reply deleted successfully", "success");
                                    await displayComments();
                                } catch (error) {
                                    console.error('Error deleting reply:', error);
                                    createPopup("Failed to delete reply", "error");
                                } finally {
                                    hideLoading();
                                }
                            }
                        });
                    }

                    repliesSection.appendChild(replyElement);
                });

                if (hideRepliesBtn) {

                    repliesSection.style.display = "none";
                    hideRepliesBtn.style.display = "block";
                    hideRepliesBtn.textContent = "Show Replies";

                    hideRepliesBtn.replaceWith(hideRepliesBtn.cloneNode(true));

                    const freshBtn = commentNode.querySelector(".hide-replies-btn");

                    freshBtn.addEventListener("click", function() {
                        const repliesDiv = this.previousElementSibling;
                        if (repliesDiv.style.display === "none") {
                            repliesDiv.style.display = "flex";
                            this.textContent = "Hide Replies";
                        } else {
                            repliesDiv.style.display = "none";
                            this.textContent = "Show Replies";
                        }
                    });
                }
            } else {

                if (hideRepliesBtn) {
                    hideRepliesBtn.style.display = "none";
                }

                if (repliesSection) {
                    repliesSection.style.display = "none";
                }
            }

            return commentNode;
        } catch (error) {
            console.error("Error creating comment node:", error);
            return null;
        }
    }

    function showLoading(message = "Loading...") {
        const spinner = document.querySelector('.loading-spinner');
        const loadingText = spinner.querySelector('.loading-text');
        loadingText.textContent = message;
        spinner.style.display = 'flex';
    }

    function hideLoading() {
        const spinner = document.querySelector('.loading-spinner');
        spinner.style.display = 'none';
    }

    async function displayComments() {
        try {
            showLoading("Loading comments...");
            await fetchComments();
            commentsWrapper.innerHTML = '';

            comments.sort((a, b) => {

                const aIsServerTimestamp = a.date && typeof a.date === 'object' && 
                                          a.date.constructor && a.date.constructor.name === 'Object' && 
                                          !a.date.seconds && !a.date.toDate;

                const bIsServerTimestamp = b.date && typeof b.date === 'object' && 
                                          b.date.constructor && b.date.constructor.name === 'Object' && 
                                          !b.date.seconds && !b.date.toDate;

                if (aIsServerTimestamp) return -1;
                if (bIsServerTimestamp) return 1;

                if (!a.date && !b.date) return 0;

                if (!a.date) return 1;  
                if (!b.date) return -1; 

                const aDate = a.date.toDate ? a.date.toDate() : 
                            (a.date.seconds ? new Date(a.date.seconds * 1000) : new Date(a.date));
                const bDate = b.date.toDate ? b.date.toDate() : 
                            (b.date.seconds ? new Date(b.date.seconds * 1000) : new Date(b.date));

                return bDate - aDate; 
            });

            comments.forEach((comment, index) => {
                const commentNode = createCommentNode(comment, index);
                if (commentNode) {
                    commentsWrapper.appendChild(commentNode);
                }
            });
        } catch (error) {
            console.error("Error displaying comments:", error);
            createPopup("Failed to load comments", "error");
        } finally {
            hideLoading();
        }
    }

    async function addComment(commentText) {
        try {
            if (!currentUser || !commentText.trim()) {
                createPopup("Please log in and enter a comment", "error");
                return;
            }

            showLoading("Posting comment...");

            if (comments.length === 0) {
                await fetchComments();
            }

            const newComment = {
                username: currentUser.username,
                text: commentText,
                replies: [],
                score: 0,
                date: firebase.firestore.FieldValue.serverTimestamp() 
            };

            const docRef = await db.collection("comments").add(newComment);

            const currentCommentInput = document.querySelector('.main-input .cmnt-input');
            if (currentCommentInput) {
                currentCommentInput.value = '';
            }

            commentsWrapper.style.display = 'block';

            newComment._id = docRef.id;

            await displayComments();

            createPopup("Comment added successfully", "success");
        } catch (error) {
            console.error('Error posting comment:', error);
            createPopup("Failed to add comment", "error");
        } finally {
            hideLoading();
        }
    }

    function updateLoginStatus() {
        if (currentUser) {
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'inline-block';
            usernameInput.style.display = 'none';

            welcomeMessage.textContent = `Welcome, ${currentUser.username}!`;
            welcomeMessage.style.display = 'block';

            checkUserHasCommented(currentUser.username).then(hasCommented => {
                if (hasCommented) {

                    commentSection.style.display = 'block';
                    showCommentBtn.style.display = 'none';
                    commentsWrapper.style.display = 'block';
                    displayComments();
                } else {

                    showCommentBtn.style.display = 'block';
                    commentSection.style.display = 'none';
                    commentsWrapper.style.display = 'none';
                }
            });
        } else {
            loginBtn.style.display = 'inline-block';
            logoutBtn.style.display = 'none';
            usernameInput.style.display = 'inline-block';
            usernameInput.value = '';
            commentSection.style.display = 'none';
            showCommentBtn.style.display = 'none';
            welcomeMessage.style.display = 'none';
            commentsWrapper.style.display = 'none';
        }
    }

    async function checkUserHasCommented(username) {
        try {
            if (!db) return false;

            const commentsSnapshot = await db.collection("comments")
                .where("username", "==", username)
                .limit(1)
                .get();

            return !commentsSnapshot.empty;
        } catch (error) {
            console.error("Error checking user comments:", error);
            return false;
        }
    }

    loginBtn.addEventListener('click', function() {
        const username = usernameInput.value.trim();
        if (!username) {
            createPopup("Please enter a username", "error");
            return;
        }

        currentUser = {
            username
        };

        localStorage.setItem('username', username);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        usernameInput.value = '';
        updateLoginStatus();
        createPopup(`Logged in as ${username}`, "success");
    });

    logoutBtn.addEventListener('click', function() {
        localStorage.removeItem('username');
        localStorage.removeItem('currentUser');
        currentUser = null;
        updateLoginStatus();
        createPopup("Successfully logged out", "success");
        commentsWrapper.innerHTML = '';
    });

    function init() {

        try {
            const storedUsername = localStorage.getItem('username');
            const storedUser = localStorage.getItem('currentUser');

            if (storedUser) {
                currentUser = JSON.parse(storedUser);
            } else if (storedUsername) {
                currentUser = {
                    username: storedUsername
                };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            }

            updateLoginStatus();

            commentInput = document.querySelector('.main-input .cmnt-input');
            sendButton = document.querySelector('.main-input .bu-primary');

            if (sendButton) {
                sendButton.addEventListener('click', function() {
                    const text = commentInput ? commentInput.value.trim() : '';
                    if (text) {
                        addComment(text);
                    } else {
                        createPopup("Please enter a comment", "error");
                    }
                });
            }

            if (commentInput) {
                commentInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const text = commentInput.value.trim();
                        if (text) {
                            addComment(text);
                        } else {
                            createPopup("Please enter a comment", "error");
                        }
                    }
                });
            }

            const mainInputImage = document.querySelector(".reply-input.main-input .usr-img");
            if (mainInputImage) {
                mainInputImage.remove();
            }

            if (showCommentBtn) {
                showCommentBtn.addEventListener('click', function() {

                    commentSection.style.display = 'block';

                    commentsWrapper.style.display = 'none';

                    this.style.display = 'none';
                });
            }
        } catch (error) {
            console.error("Error during initialization:", error);
        }
    }

    videoList.addEventListener('click', function(e) {

        const listItem = e.target.closest('li');

        if (listItem) {

            const videoSrc = listItem.getAttribute('data-video');

            if (videoSrc && !videoSrc.includes('Soon to come')) {

                videoPlayer.src = videoSrc;

                videoPlayer.load();
                videoPlayer.play();

                document.querySelectorAll('#video-list li').forEach(item => {
                    item.classList.remove('active');
                });
                listItem.classList.add('active');
            }
        }
    });

    setupFirebase();
});