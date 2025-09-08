let currentTaskInterval = null;
async function getTaskList() {
  try {
    const userInfo = await window.WatchAPI.getUserInfo();
    const taskListUrl = BASE_URL.TASK_API_BASE_URL + API_ENDPOINT.TASK_LIST;
    const requestInfo = {
      method: "GET",
      url: taskListUrl,
            authType : 'bearertoken',
      queryParams: {
                'filter[user_id]': userInfo.user.user_id
            }
        }
    const taskList = await window.WatchAPI.makeAsyncApiRequest(requestInfo);
    return taskList;
  } catch (error) {
    throw error;
  }
}

async function structureTaskList(scrumTaskList) {
  if (scrumTaskList == null) return null;
  let allTasksList = [];
  scrumTaskList.forEach((eachTaskScrum) => {
    eachTaskScrum?.members?.forEach((eachMember) => {
      eachMember?.tasks?.forEach((eachTask) => {
        eachTask.team_name = eachTaskScrum.team_name;
        allTasksList.push(eachTask);
      });
    });
  });
  let currentRunningTask = await window.WatchAPI.currentRunningTask();
  if (currentRunningTask) {
    const taskExists = allTasksList.some(task => task.id === currentRunningTask.task_id);
    if (!taskExists) {
      // stop the current running task
      await window.WatchAPI.stopCurrentRunningTaskInBackground();
    }
  }
  //  sort by added_to_scrum_at desc
  allTasksList.sort((a, b) => new Date(b.added_to_scrum_at) - new Date(a.added_to_scrum_at));
  return allTasksList.length > 0 ? allTasksList : null;
}

function displayTaskListInDropdown(structuredtaskList) {
  let taskList = "<option></option>";
  structuredtaskList.forEach((eachTask) => {
    if (eachTask.is_owner) {
      taskList += `
            <option
                value="${eachTask.id}"
                data-task-title="${eachTask.taskTitle}"
                data-project-id="${eachTask.project_id}"
                data-project-name="${eachTask.project_name}"
                data-team-id="${eachTask.team_id}"
                data-sprint-id="${eachTask.sprint_id}"
                data-task-key="${eachTask.taskKey}"
                data-checked= "${eachTask.checked}"
                data-user-id="${eachTask.user_id}"
                data-status-color="${eachTask.status_color}"
                data-status-title="${eachTask.status_title}"
                data-team-name="${eachTask.team_name}"
            >
            ${eachTask.taskKey}: ${eachTask.taskTitle}
            </option>`;
    }
  });
  const taskListDropdown = document.querySelector(".tasklistDropdown");
  taskListDropdown.innerHTML = taskList;
  taskListDropdown.removeAttribute("disabled");

  const options = document.querySelectorAll(".tasklistDropdown option");
  options.forEach((option) => {
    if (option.getAttribute("data-checked") === "true") {
      option.style.display = "none";
      option.disabled = true;
    }
  });
}

async function displayTodaysScrum(structuredTaskList) {
  const todaysScrumContainer = document.querySelector(
    ".todays-taskList-outer .todays-taskList"
  );
  const noScrumContainer = document.querySelector(
    ".todays-taskList-outer .noScrum"
  );
  const currentRunningTask = await window.WatchAPI.currentRunningTask();
  const currentRunningTaskId = currentRunningTask
    ? currentRunningTask.task_id
    : null;
  const todaysScrumList = await todaysScrumHtml(
    structuredTaskList,
    currentRunningTaskId
  );

  if (todaysScrumList) {
    noScrumContainer.innerHTML = null;
    todaysScrumContainer.innerHTML = todaysScrumList;
  } else {
    noScrumContainer.innerHTML = `<div class="card" id="taskNotStarted">
                <div class="card-body profile-card pt-4 d-flex flex-column align-items-center">
                    <img src="../assets/img/scrum.png" alt="ready-to-start">
                    <p>There is no task in today's scrum. Please add.</p>
                </div>
            </div>`;
  }
}

async function todaysScrumHtml(allTasks, currentRunningTaskId) {
  try {
    let taskList = "";
    if (currentRunningTaskId == null) {
      currentRunningTaskId = 0;
    }
    if (allTasks == null) {
      return null;
    }

    for (const eachTask of allTasks) {
      if (eachTask.is_owner && eachTask.checked === true) {
        // Create a unique ID for each task time badge to target later
        const taskTimeBadgeId = `task-time-badge-${eachTask.id}`;
        
        // Fetch the initial spent time for the task
        const initialTaskTimeInSeconds = await window.WatchAPI.getEachTaskWorkLogInfo(eachTask.id);
        const formattedTime = formatTime(initialTaskTimeInSeconds);
        
        // HTML structure for each task
        taskList += `
                <div class="eachTaskWrap"
                  data-user-id="${eachTask.user_id}"
                  data-sprint-id="${eachTask.sprint_id}"
                  data-team-id="${eachTask.team_id}"
                  data-team-name="${eachTask.team_name}"
                  data-task-id="${eachTask.id}"
                  data-task-title="${eachTask.taskKey}: ${eachTask.taskTitle}"
                  data-project-id="${eachTask.project_id}"
                  data-project-name="${eachTask.project_name}"
                  data-scrumlog-id="${eachTask.scrumlog_id}">
                <div class="row work-card border-top pt-2">
                <div class="col-auto pe-0 taskCancel text-indigo">
                    <i class="bi bi-trash" onClick="deleteTask(event, ${eachTask.id})"></i>
                </div>
                <div class="col-sm-5">
                  <h4 class="taskTitle m-0">${eachTask.taskKey}: ${eachTask.taskTitle}</h4>
                  <h5>
                      <a class="task-details-external-link" href="#" data-task-id="${
                        eachTask.id
                      }">
                          ${eachTask.taskKey}
                      </a>
                      | ${eachTask.project_name}
                  </h5>
                </div>
                    <div class="col-1 text-center">
                        <span class="badge bg-teal" style="padding: 5px 6px 5px 6px; "}>${
                          eachTask.expected_spent_time != ""
                            ? eachTask.expected_spent_time
                            : "NA"
                        }</span>
                    </div>
                    
                    <div class="col-auto text-center">
                        <span class="dot ${
                          eachTask.id === currentRunningTaskId
                            ? "bg-green"
                            : "bg-red"
                        } mt-1 start-stop-flag"></span>
                    </div>

                    <div class="col text-center">
                      <span id="${taskTimeBadgeId}" class="badge bg-indigo" style="padding: 5px 6px 5px 6px; ">${formattedTime}</span>
                    </div>

                    <div class="col">
                      <span class="badge" style="background-color: ${ eachTask.status_color }; color:white; padding: 5px 6px 5px 6px;" >
                      ${ eachTask.status_title
                          ? eachTask.status_title
                          : "NA"}
                      </span>
                      <button type="button" class="task-status-change-toogle-btn btn btn-sm dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown" aria-expanded="false"
                        style="background-color: ${ eachTask.status_color }; color:white; padding: 0px 6px 0px 6px;"
                        data-task-id="${eachTask.id}" >
                        <span class="visually-hidden">Toggle Dropdown</span>
                      </button>
                      <ul class="dropdown-menu task-status-menu">
                        <li><a class="dropdown-item" href="#">Loading...</a></li>
                      </ul>
                    </div>

                    <div class="col-auto text-center">
                        <button type="button" class="btn ${
                          eachTask.id === currentRunningTaskId
                            ? "btn-red"
                            : "btn-green"
                        } 
                            taskStartStop" style="padding-top : 0; padding-bottom : 0; font-size: 0.875rem;" 
                            data-currentStatus="${
                              eachTask.id === currentRunningTaskId
                                ? "start"
                                : "stop"
                            }" 
                            onClick="taskStartStopMethod(event);">
                            ${
                              eachTask.id === currentRunningTaskId
                                ? "Stop"
                                : "Start"
                            }
                        </button>
                    </div>
                </div>`;

          taskList += `
                    <div class="row d-flex work-card pb-2">
                        <div class="col-sm-2 col-md-2-percent">
                            <span class="dot-small bg-indigo mt-1"></span>
                        </div>
                        <div class="col-sm-4">
                            <div id="gridInlineEditableDiv">
                              <span class="gridInlineEditText text-navy" onclick="updateTaskCommentIcon(event)">
                                  ${eachTask.comment}
                              </span>
                              <div class="gridInlineEditable text-navy updateTaskComment d-none">
                                <form class="row g-3 updateTaskCommentForm" method="post" action="#">
                                    <input type="hidden" name="taskId" class="taskId" value="${eachTask.id}">
                                    <input type="hidden" name="taskTitle" class="task" value="${eachTask.taskTitle}">
                                    <input type="hidden" name="sprintId" class="sprintId" value="${eachTask.sprint_id}">
                                    <input type="hidden" name="projectId" class="projectId" value="${eachTask.project_id}">
                                    <input type="hidden" name="projectName" class="projectName" value="${eachTask.project_name}">
                                    <input type="hidden" name="teamId" class="teamId" value="${eachTask.team_id}">
                                    <input type="hidden" name="userId" class="userId" value="${eachTask.user_id}">
                                    <input type="hidden" name="teamName" class="teamName" value="${eachTask.team_name}">
                                    <textarea class="form-control currentScrumComment" name="comment" style="height: 80px;" rows="3">${eachTask.comment}</textarea>
                                    <div class="d-flex flex-row-reverse p-0 mt-1">
                                      <button type="submit" class="btn btn-navy gridInlineEditSave" title="Save" onclick="updateTask(event)">
                                          <i class="bi bi-check-circle"></i>
                                      </button>
                                      <button type="button" class="btn btn-navy gridInlineEditCancel" title="Close" onclick="updateTaskCancel(event)">
                                          <i class="bi bi-x-lg"></i>
                                      </button>
                                    </div>
                                </form>
                              </div>
                            </div>
                        </div>
                    </div>`;
        taskList += "</div>";

        // Only start the counter if this task is the currently running task
        if (eachTask.id === currentRunningTaskId) {
          setTimeout(() => {
            const taskBadgeElement = document.getElementById(taskTimeBadgeId);
            if (taskBadgeElement) {
              updateTaskTimeBadge(eachTask.id, taskBadgeElement);
            }
          }, 100);
        }
      }
    }
    return taskList;
  } catch (error) {
    return null;
  }
}

/**
 * choose task from dropdown list and open modal dialog
 */
const selectElement = document.querySelector(".tasklistDropdown");
const submitScrumButton = document.getElementById("submitScrum");
submitScrumButton.addEventListener("click", async function (e) {
  e.preventDefault();
  const selectedOption = selectElement.options[selectElement.selectedIndex];

  if (selectedOption && selectedOption.value) {
    document.querySelector("#taskDescriptionModal .taskName").innerHTML =
      selectedOption.text;
    document.querySelector("#taskDescriptionModal .userId").value =
      selectedOption.dataset.userId;
    document.querySelector("#taskDescriptionModal .taskId").value =
      selectedOption.value;
    document.querySelector("#taskDescriptionModal .taskTitle").value =
      selectedOption.dataset.taskTitle;
    document.querySelector("#taskDescriptionModal .projectId").value =
      selectedOption.dataset.projectId;
      document.querySelector("#taskDescriptionModal .projectName").value =
      selectedOption.dataset.projectName;
    document.querySelector("#taskDescriptionModal .taskKey").value =
      selectedOption.dataset.taskKey;
    document.querySelector("#taskDescriptionModal .sprintId").value =
      selectedOption.dataset.sprintId;
    document.querySelector("#taskDescriptionModal .teamId").value =
      selectedOption.dataset.teamId;
    document.querySelector("#taskDescriptionModal .statusColor").value =
      selectedOption.dataset.statusColor;
    document.querySelector("#taskDescriptionModal .statusTitle").value =
      selectedOption.dataset.statusTitle;
    document.querySelector("#taskDescriptionModal .teamName").value =
      selectedOption.dataset.teamName;

    const taskDescriptionModal = new bootstrap.Modal(
      document.getElementById("taskDescriptionModal"),
      { backdrop: "static" }
    );
    taskDescriptionModal.show();
  } else {
    showToast("error", "Please choose a task.");
  }
});

/**
 * post scrum
 */
var closeTaskButton = document.querySelector("#closeTask");
closeTaskButton.addEventListener("click", function () {
  postScrum.reset();
});

const postScrumForm = document.getElementById("postScrum");
postScrumForm.addEventListener("submit", async (e) => {
  let requestInfo = {};
  try {
    e.preventDefault();
    postScrumBtn = document.getElementById("postTask");
    postScrumBtn.innerText = "Processing...";
    postScrumBtn.disabled = true;
    const formData = new FormData(postScrumForm);
    const formObject = Object.fromEntries(formData);

    const scrumObject = {
      sprint_id: formObject.sprintId,
      team_id: formObject.teamId,
      dataArr: [
        {
          id: formObject.taskId,
          user_id: formObject.userId,
          comment: formObject.taskComment,
          expected_spent_time: formObject.expectedTimeSpent,
          checked: true,
        },
      ],
    };

    const scrumPostUrl = BASE_URL.TASK_API_BASE_URL + API_ENDPOINT.TASK_LIST;
    requestInfo = {
      method: "POST",
      url: scrumPostUrl,
      authType: "bearertoken",
      requestData: scrumObject,
    };
    const scrumPostResponse = await window.WatchAPI.makeAsyncApiRequest(
      requestInfo
    );

    if (scrumPostResponse && scrumPostResponse.data.data) {
      //insert or update in sqlite db
      const scrumTaskDetails = {
        project_id: formObject.projectId,
        project_name: formObject.projectName,
        task_id: formObject.taskId,
        scrum_message: formObject.taskComment,
        expected_spent_time: formObject.expectedTimeSpent,
        team_id: formObject.teamId,
        team_name: formObject.teamName,
      };
      const scrumEntryResponse = await window.WatchAPI.scrumEntry(
        scrumTaskDetails
      );

      // show newly added task in today's scrum
      const noScrumElement = document.querySelector(".noScrum");
      if (noScrumElement) {
        noScrumElement.innerHTML = null;
      }

      const newTaskObject = [
        {
          checked: true,
          id: formObject.taskId,
          user_id: formObject.userId,
          is_owner: true,
          taskKey: formObject.taskKey,
          taskTitle: formObject.taskTitle,
          sprint_id: formObject.sprintId,
          team_id: formObject.teamId,
          team_name: formObject.teamName,
          comment: formObject.taskComment,
          project_id: formObject.projectId,
          project_name: formObject.projectName,
          scrumlog_id: scrumEntryResponse.scrumEntryId,
          expected_spent_time: formObject.expectedTimeSpent,
          status_color: formObject.statusColor,
          status_title: formObject.statusTitle,
        },
      ];

      const newTaskHtml = await todaysScrumHtml(newTaskObject, null);
      const existingTask = document.querySelector(
        `.eachTaskWrap[data-task-id="${formObject.taskId}"]`
      );
      if (existingTask) {
        // Update the elements if the task is already present
        const textElement = existingTask.querySelector(".gridInlineEditText");
        const textareaElement = existingTask.querySelector(
          ".currentScrumComment"
        );
        if (textElement && textareaElement) {
          textElement.innerHTML = formObject.taskComment;
          textareaElement.value = formObject.taskComment;
        }
      } else {
        // If the task is not present, append the new task HTML
        document.querySelector(
          ".todays-taskList-outer .todays-taskList"
        ).innerHTML += newTaskHtml;
        //append new task at the top
        const container = document.querySelector(
          ".todays-taskList-outer .todays-taskList"
        );
        const newTaskElement = container.lastElementChild;
        container.insertBefore(newTaskElement, container.firstChild);
      }

      const selectElement = document.querySelector(".tasklistDropdown");
      for (let i = 0; i < selectElement.options.length; i++) {
        const option = selectElement.options[i];
        if (option.value == parseInt(formObject.taskId)) {
          option.disabled = true; // Disable the option to ensure it is hidden
          break;
        }
      }
      if(refreshTaskListAndScrumBtn) {
        refreshTaskListAndScrumBtn.click();
      }      
      closeTaskButton.click();
    }
    if (scrumPostResponse && scrumPostResponse.data.errors) {
      error = await formatBMSAPIError(scrumPostResponse.data);
      showToast("error", error.errors.message);
    }
  } catch (error) {
    requestInfo.requestData.dataArr[0].checked = false;
    await window.WatchAPI.makeAsyncApiRequest(requestInfo);
    showToast(
      "error",
      "Something went wrong. Please try again or contact support."
    );
  } finally {
    postScrumBtn.innerText = "Submit";
    postScrumBtn.disabled = false;
  }
});

document.addEventListener("click", (event) => {
    if (event.target.matches(".task-details-external-link")) {
        event.preventDefault();
        const taskId = event.target
        .closest(".eachTaskWrap")
        .getAttribute("data-task-id");
        const url =
        BMS_EXTERNAL_LINKS.WORKS +
        BMS_EXTERNAL_LINKS_END_POINTS.VIEW_TASK +
        "/" +
        taskId;
        window.WatchAPI.openExternal(url);
    }
});

/**
 * update task comment icon click
 */
function updateTaskCommentIcon(event) {
    event.target.classList.add("d-none");
    var nextElement = event.target.nextElementSibling;

    if (nextElement) {
        var textarea = nextElement.querySelector("textarea");
        if (textarea) {
            textarea.value = event.target.textContent.trim();
            nextElement.classList.remove("d-none");
        }
    }
}

async function deleteTaskRowEntry(eachTaskWrap, formObjectTaskId) {
    eachTaskWrap.remove();
    
    if(document.querySelector('.todays-taskList').innerHTML.trim() === '' && document.querySelector('.todays-taskList').textContent.trim() === '') {
        let noScrum = document.querySelector('.todays-taskList-outer .noScrum');
        if (noScrum) {
            noScrum.innerHTML = 'Please do the scrum';
        }
    }

    const selectElement = document.querySelector(".tasklistDropdown");

    for (let i = 0; i < selectElement.options.length; i++) {
        const option = selectElement.options[i];
        if (option.value == parseInt(formObjectTaskId)) {
            option.disabled = false; // Enable the option to ensure it is hidden
            break;
        }
    }
}

async function updateTaskRowEntry(eachTaskWrap, formObjectComment, taskModifyResponseMessage) {
    const gridInlineEditable = eachTaskWrap.querySelector(".gridInlineEditable");
    const gridInlineEditText = gridInlineEditable.previousElementSibling;

    if (gridInlineEditText) {
    gridInlineEditText.textContent = formObjectComment;
    }

    showToast("success", taskModifyResponseMessage);
    gridInlineEditable.classList.add("d-none");
    gridInlineEditable.previousElementSibling.classList.remove("d-none");
}

/**
 * update task
 */
async function updateTask(event, taskStatus = true) {
    event.preventDefault();
  
    const eachTaskWrap = event.target.closest(".eachTaskWrap");
    const updateTaskForm = eachTaskWrap.querySelector(".updateTaskCommentForm");
    const updateTaskCommentFormData = new FormData(updateTaskForm);
    const formObject = Object.fromEntries(updateTaskCommentFormData);
  
    const taskObject = {
        sprint_id: formObject.sprintId,
        team_id: formObject.teamId,
        dataArr: [
            {
                id: formObject.taskId,
                user_id: parseInt(formObject.userId),
                comment: formObject.comment,
                checked: taskStatus,
            },
        ],
    };

    const taskModifyUrl = BASE_URL.TASK_API_BASE_URL + API_ENDPOINT.SCRUM_ENTRY;
    const taskModifyRequestInfo = {
      method: "POST",
      url: taskModifyUrl,
      authType: "bearertoken",
      requestData: taskObject,
    };
  
    const taskModifyResponse = await window.WatchAPI.makeAsyncApiRequest(
      taskModifyRequestInfo
    );

    if (taskModifyResponse && taskModifyResponse.data.errors) {
        error = await formatBMSAPIError(taskModifyResponse.data);
        showToast("error", error.errors.message);
    }
    if (taskModifyResponse && taskModifyResponse.data.data) {
        
        if (taskStatus == false) { //delete the task
            await deleteTaskRowEntry(eachTaskWrap, formObject.taskId);        
        } else { //update the task
            await updateTaskRowEntry(eachTaskWrap, formObject.comment, taskModifyResponse.data.data.message);
        }
  
    } else {
      showToast("error", taskModifyResponse.data.message);
    }
  
}

/**
 * Cancel the Update Task Comment option
 */
function updateTaskCancel(event) {
    const gridInlineEditable = event.target.closest(".gridInlineEditable");
    gridInlineEditable.classList.add("d-none");
    const gridInlineEditText = gridInlineEditable.previousElementSibling;

    gridInlineEditText.classList.remove("d-none");
}

/**
 * Delete Task from Today's Task List
 */

async function deleteTask(event, eachTaskId) {
    const currentRunningTask = await window.WatchAPI.currentRunningTask();
    const currentRunningTaskId = currentRunningTask ? currentRunningTask.task_id : null;
    if (currentRunningTaskId && (currentRunningTaskId == eachTaskId)) {
        showToast("error", WARNING_MSG.STOP_CURRENT_TASK);
    } else {
        Swal.fire({
            title: WARNING_MSG.SURE_TO_DELETE_TASK,
            showCancelButton: true,
            confirmButtonText: "Yes",
            allowOutsideClick: false,
        }).then(async(result) => {
            if (result.isConfirmed) {
                const eachTaskWrap = event.target.closest(".eachTaskWrap");
                
                const scrumlogId = eachTaskWrap.getAttribute("data-scrumlog-id");
                await window.WatchAPI.deleteScrumEntry(scrumlogId);
                updateTask(event, false);
            }
        });
    }
}


/**
 * refresh tasklist and scrum
 */

const refreshTaskListAndScrumBtn = document.getElementById('refreshTaskListAndScrum');
refreshTaskListAndScrumBtn.addEventListener('click', async () =>{
  try {
    refreshTaskListAndScrumBtn.innerText = "Processing...";
    refreshTaskListAndScrumBtn.disabled = true;
    await populateTaskListAndScrum();
    userInfo = await window.WatchAPI.getUserInfo();
    startTodaysTotalTaskTimeCounter(userInfo.user.user_id);
    displayTotalBreakTime();
  } catch (error) {
    showToast("error", ERROR_MEG.INTERNAL_ERROR);
  } finally {
    refreshTaskListAndScrumBtn.innerText = "Refresh";
    refreshTaskListAndScrumBtn.disabled = false;
  }
})

window.WatchAPI.onRefreshTrigger(() => {
  //console.log('Button click trigger received:');
  if (refreshTaskListAndScrumBtn) {
    refreshTaskListAndScrumBtn.click();
  }
});


async function populateTaskListAndScrum() {
  try {
    const noScrumContainer = document.querySelector(".todays-taskList-outer .noScrum");
    const taskList = await getTaskList();
    if(taskList.data.data.length > 0) {
        const structuredTaskList = await structureTaskList(taskList.data.data);
        if (structuredTaskList == null) {
            /* noScrumContainer.innerHTML += `<div class="card" id="taskNotStarted">
                    <div class="card-body profile-card pt-4 d-flex flex-column align-items-center">
                        <img src="../assets/img/no-task.png" alt="ready-to-start">
                        <p>You dont have any task in system. Please consult with respective people.</p>
                    </div>
                </div>`; */
          noScrumContainer.innerHTML = `<div class="card" id="taskNotStarted">
                <div class="card-body profile-card pt-4 d-flex flex-column align-items-center">
                    <img src="../assets/img/no-task.png" alt="ready-to-start">
                    <p>You dont have any task in system. Please consult with respective people.</p>
                </div>
            </div>`;
        }
        // check if scrum already done and populate scrum_entry table
        for (const task of structuredTaskList) {
            if (task.checked) {
                const scrumTaskDetails = {
                    project_id: task.project_id,
                    project_name: task.project_name,
                    task_id: task.id,
                    task_title: task.taskTitle,
                    scrum_message: task.comment,
                    expected_spent_time : task.expected_spent_time,
                    team_id: task.team_id,
                    team_name: task.team_name,
                };
                try {
                    const scrumEntryResponse = await window.WatchAPI.scrumEntry(scrumTaskDetails);
                    if (scrumEntryResponse && scrumEntryResponse.scrumEntryId) {
                        task.scrumlog_id = scrumEntryResponse.scrumEntryId;
                    }
                } catch (err) {
                    showToast("error", 'Wroks System Error : ' + ERROR_MEG.INTERNAL_ERROR);
                }
            }
        }
        displayTaskListInDropdown(structuredTaskList);
        displayTodaysScrum(structuredTaskList);
    } else {
        /* noScrumContainer.innerHTML += `<div class="card" id="taskNotStarted">
                    <div class="card-body profile-card pt-4 d-flex flex-column align-items-center">
                        <img src="../assets/img/no-task.png" alt="ready-to-start">
                        <p>You dont have any task in system. Please consult with respective people.</p>
                    </div>
                </div>`; */
        noScrumContainer.innerHTML = `<div class="card" id="taskNotStarted">
                <div class="card-body profile-card pt-4 d-flex flex-column align-items-center">
                    <img src="../assets/img/no-task.png" alt="ready-to-start">
                    <p>You dont have any task in system. Please consult with respective people.</p>
                </div>
            </div>`;
    }
  } catch (error) {
      showToast("error", ERROR_MEG.INTERNAL_ERROR);
  }
}

// task status change
document.addEventListener("click", async (event) => {
  if (event.target.classList.contains("task-status-change-toogle-btn")) {
    const taskId = event.target.getAttribute("data-task-id");
    const dropdownMenu = event.target.closest('div').querySelector('.task-status-menu');
    dropdownMenu.innerHTML = "<li><a class='dropdown-item' href='#'>Loading...</a></li>";

    try {
      const taskStatusListUrl = BASE_URL.TASK_API_BASE_URL + API_ENDPOINT.TASK_STATUS;
      const requestInfo = {
        method: "GET",
        url: taskStatusListUrl,
        authType: 'bearertoken',
        queryParams: {
          'task_id': taskId
        }
      };
      const taskStatusListResponse = await window.WatchAPI.makeAsyncApiRequest(requestInfo);
      dropdownMenu.innerHTML = "";

      if (taskStatusListResponse.data.errors) {
        dropdownMenu.innerHTML = "<li><a class='dropdown-item' href='#'>Failed to load statuses</a></li>";
        return;
      }

      taskStatusListResponse.data.data.forEach((status) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <a class="dropdown-item" href="#" data-task-id="${taskId}" data-status-id="${status.task_status_id}" style="color: ${status.background_color_code};">
            ${status.title}
          </a>`;
        dropdownMenu.appendChild(li);
      });
    } catch (error) {
      dropdownMenu.innerHTML = "<li><a class='dropdown-item' href='#'>Failed to load statuses</a></li>";
    }
  }

  if (event.target.classList.contains("dropdown-item")) {
    const taskContainer = event.target.closest('div');
    const dropdownToggle = taskContainer.querySelector('.task-status-change-toogle-btn');
    const spinner = document.createElement("span");

    dropdownToggle.disabled = true;

    spinner.className = "spinner-border spinner-border-sm ms-2";
    spinner.setAttribute("role", "status");
    spinner.setAttribute("aria-hidden", "true");
    dropdownToggle.parentElement.appendChild(spinner);

    const taskId = event.target.getAttribute("data-task-id");
    const statusId = event.target.getAttribute("data-status-id");
    const selectedStatusTitle = event.target.textContent;
    const selectedStatusColor = event.target.style.color;

    const updateTaskStatusUrl = BASE_URL.TASK_API_BASE_URL + API_ENDPOINT.TASK + '/id/' + taskId;

    try {
      const payload = {
        fieldName: "task_status_id",
        fieldValue: statusId
      };
      const requestInfo = {
        method: "PATCH",
        url: updateTaskStatusUrl,
        authType: 'bearertoken',
        requestData: payload
      };
      const updateResponse = await window.WatchAPI.makeAsyncApiRequest(requestInfo);

      if (updateResponse.data.data) {
        const badge = taskContainer.querySelector('.badge');
        badge.style.backgroundColor = selectedStatusColor;
        badge.textContent = selectedStatusTitle;
        dropdownToggle.style.backgroundColor = selectedStatusColor;
      } else {
        showToast("error", ERROR_MEG.TASK_STATUS_CHANGE_ERROR);
      }
    } catch (error) {
      showToast("error", ERROR_MEG.TASK_STATUS_CHANGE_ERROR);
    } finally {
      spinner.remove();
      dropdownToggle.disabled = false;
    }
  }
});
