const $ = (selector, root = document) => root.querySelector(selector);

const toast = $("#toast");
let toastTimer = null;

function showToast(message) {
	if (!toast) return;
	toast.textContent = message;
	toast.classList.add("is-visible");
	if (toastTimer) window.clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => {
		toast.classList.remove("is-visible");
	}, 1200);
}

async function copySnippet(snippetName, container) {
	const codeEl = container.querySelector(
		`[data-modal-panel="${snippetName}"] .modal-code`,
	);
	if (!codeEl) return;

	const text = codeEl.innerText.trim();

	try {
		await navigator.clipboard.writeText(text);
		showToast("Copied");
	} catch {
		showToast("Copy failed");
	}
}

function setupThemeListener() {
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

	function handleThemeChange(e) {
		const saved = localStorage.getItem("doce-theme");
		if (saved) return;

		const html = document.documentElement;
		if (e.matches) {
			html.classList.add("dark");
		} else {
			html.classList.remove("dark");
		}
	}

	mediaQuery.addEventListener("change", handleThemeChange);
}

function setupVideoSync() {
	const videos = document.querySelectorAll(".video");
	if (videos.length < 2) return;

	const [darkVideo, lightVideo] = videos;

	function syncVideos() {
		if (darkVideo.readyState >= 2 && lightVideo.readyState >= 2) {
			lightVideo.currentTime = darkVideo.currentTime;
		}
	}

	darkVideo.addEventListener("timeupdate", syncVideos);
	lightVideo.addEventListener("loadedmetadata", syncVideos);
}

function setupModal() {
	const modal = $("#selfhost-modal");
	const trigger = $("#selfhost-trigger");
	const backdrop = $("#modal-backdrop");
	const closeBtn = $(".modal-close", modal);

	function openModal() {
		modal.classList.add("is-open");
		document.body.style.overflow = "hidden";
	}

	function closeModal() {
		modal.classList.remove("is-open");
		document.body.style.overflow = "";
	}

	trigger?.addEventListener("click", openModal);
	closeBtn?.addEventListener("click", closeModal);
	backdrop?.addEventListener("click", closeModal);

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && modal.classList.contains("is-open")) {
			closeModal();
		}
	});

	const copyBtns = modal.querySelectorAll(".modal-copy-btn");
	copyBtns.forEach((btn) => {
		btn.addEventListener("click", () => {
			const codeEl = btn
				.closest(".modal-code-wrap")
				.querySelector(".modal-code");
			if (!codeEl) return;

			const text = codeEl.innerText.trim();
			navigator.clipboard
				.writeText(text)
				.then(() => {
					showToast("Copied");
				})
				.catch(() => {
					showToast("Copy failed");
				});
		});
	});
}

setupThemeListener();
setupVideoSync();
setupModal();
