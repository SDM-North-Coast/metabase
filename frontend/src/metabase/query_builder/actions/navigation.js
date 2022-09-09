import { parse as parseUrl } from "url";
import { createAction } from "redux-actions";
import { push, replace } from "react-router-redux";

import {
  cleanCopyCard,
  deserializeCardFromUrl,
  serializeCardForUrl,
} from "metabase/lib/card";
import { isAdHocModelQuestion } from "metabase/lib/data-modeling/utils";
import { createThunkAction } from "metabase/lib/redux";
import Utils from "metabase/lib/utils";

import { getMetadata } from "metabase/selectors/metadata";

import Question from "metabase-lib/lib/Question";

import {
  getCard,
  getDatasetEditorTab,
  getOriginalQuestion,
  getQueryBuilderMode,
  getQuestion,
  getZoomedObjectId,
} from "../selectors";
import { getQueryBuilderModeFromLocation } from "../typed-utils";
import {
  getCurrentQueryParams,
  getPathNameFromQueryBuilderMode,
  getURLForCardState,
} from "../utils";

import { initializeQB, setCardAndRun } from "./core";
import { resetRowZoom, zoomInRow } from "./object-detail";
import { cancelQuery } from "./querying";
import { setQueryBuilderMode } from "./ui";

export const SET_CURRENT_STATE = "metabase/qb/SET_CURRENT_STATE";
const setCurrentState = createAction(SET_CURRENT_STATE);

export const POP_STATE = "metabase/qb/POP_STATE";
export const popState = createThunkAction(
  POP_STATE,
  location => async (dispatch, getState) => {
    dispatch(cancelQuery());

    const zoomedObjectId = getZoomedObjectId(getState());
    if (zoomedObjectId) {
      const { locationBeforeTransitions = {} } = getState().routing;
      const { state, query } = locationBeforeTransitions;
      const previouslyZoomedObjectId = state?.objectId || query?.objectId;

      if (
        previouslyZoomedObjectId &&
        zoomedObjectId !== previouslyZoomedObjectId
      ) {
        dispatch(zoomInRow({ objectId: previouslyZoomedObjectId }));
      } else {
        dispatch(resetRowZoom());
      }
      return;
    }

    const card = getCard(getState());
    if (location.hash) {
      const cardFromUrl = deserializeCardFromUrl(location.hash);

      if (!Utils.equals(card, cardFromUrl)) {
        const newState = {
          card: cardFromUrl,
          cardId: cardFromUrl.id,
          serializedCard: serializeCardForUrl(cardFromUrl),
          objectId: location.state?.objectId,
        };

        await dispatch(setCardAndRun(cardFromUrl, cardFromUrl.dataset));
        await dispatch(setCurrentState(newState));
      }
    }

    const { queryBuilderMode: queryBuilderModeFromURL, ...uiControls } =
      getQueryBuilderModeFromLocation(location);

    if (getQueryBuilderMode(getState()) !== queryBuilderModeFromURL) {
      await dispatch(
        setQueryBuilderMode(queryBuilderModeFromURL, {
          ...uiControls,
          shouldUpdateUrl: queryBuilderModeFromURL === "dataset",
        }),
      );
    }
  },
);

const getURL = (location, { includeMode = false } = {}) =>
  // strip off trailing queryBuilderMode
  (includeMode
    ? location.pathname
    : location.pathname.replace(/\/(notebook|view)$/, "")) +
  location.search +
  location.hash;

// Logic for handling location changes, dispatched by top-level QueryBuilder component
export const locationChanged =
  (location, nextLocation, nextParams) => dispatch => {
    if (location !== nextLocation) {
      if (nextLocation.action === "POP") {
        if (
          getURL(nextLocation, { includeMode: true }) !==
          getURL(location, { includeMode: true })
        ) {
          // the browser forward/back button was pressed
          dispatch(popState(nextLocation));
        }
      } else if (
        (nextLocation.action === "PUSH" || nextLocation.action === "REPLACE") &&
        // ignore PUSH/REPLACE with `state` because they were initiated by the `updateUrl` action
        nextLocation.state === undefined
      ) {
        // a link to a different qb url was clicked
        dispatch(initializeQB(nextLocation, nextParams));
      }
    }
  };

export const UPDATE_URL = "metabase/qb/UPDATE_URL";
export const updateUrl = createThunkAction(
  UPDATE_URL,
  (
      card,
      {
        dirty,
        replaceState,
        preserveParameters = true,
        queryBuilderMode,
        datasetEditorTab,
        objectId,
      } = {},
    ) =>
    (dispatch, getState) => {
      let question;
      if (!card) {
        card = getCard(getState());
        question = getQuestion(getState());
      } else {
        question = new Question(card, getMetadata(getState()));
      }

      if (dirty == null) {
        const originalQuestion = getOriginalQuestion(getState());
        const isAdHocModel = isAdHocModelQuestion(question, originalQuestion);
        dirty =
          !originalQuestion ||
          (!isAdHocModel && question.isDirtyComparedTo(originalQuestion));
      }

      // prevent clobbering of hash when there are fake parameters on the question
      // consider handling this in a more general way, somehow
      if (question.isStructured() && question.parameters().length > 0) {
        dirty = true;
      }

      if (!queryBuilderMode) {
        queryBuilderMode = getQueryBuilderMode(getState());
      }
      if (!datasetEditorTab) {
        datasetEditorTab = getDatasetEditorTab(getState());
      }

      const copy = cleanCopyCard(card);

      const newState = {
        card: copy,
        cardId: copy.id,
        serializedCard: serializeCardForUrl(copy),
        objectId,
      };

      const { currentState } = getState().qb;
      const queryParams = preserveParameters ? getCurrentQueryParams() : {};
      const url = getURLForCardState(newState, dirty, queryParams, objectId);

      const urlParsed = parseUrl(url);
      const locationDescriptor = {
        pathname: getPathNameFromQueryBuilderMode({
          pathname: urlParsed.pathname || "",
          queryBuilderMode,
          datasetEditorTab,
        }),
        search: urlParsed.search,
        hash: urlParsed.hash,
        state: objectId !== undefined ? { objectId } : undefined,
      };

      const isSameURL =
        locationDescriptor.pathname === window.location.pathname &&
        (locationDescriptor.search || "") === (window.location.search || "") &&
        (locationDescriptor.hash || "") === (window.location.hash || "");
      const isSameCard =
        currentState && currentState.serializedCard === newState.serializedCard;
      const isSameMode =
        getQueryBuilderModeFromLocation(locationDescriptor).mode ===
        getQueryBuilderModeFromLocation(window.location).mode;

      if (isSameCard && isSameURL) {
        return;
      }

      if (replaceState == null) {
        // if the serialized card is identical replace the previous state instead of adding a new one
        // e.x. when saving a new card we want to replace the state and URL with one with the new card ID
        replaceState = isSameCard && isSameMode;
      }

      // this is necessary because we can't get the state from history.state
      dispatch(setCurrentState(newState));
      if (replaceState) {
        dispatch(replace(locationDescriptor));
      } else {
        dispatch(push(locationDescriptor));
      }
    },
);
