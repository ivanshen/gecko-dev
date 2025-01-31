/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/dom/cache/StreamControl.h"

namespace mozilla {
namespace dom {
namespace cache {

void StreamControl::AddReadStream(ReadStream::Controllable* aReadStream) {
  AssertOwningThread();
  MOZ_DIAGNOSTIC_ASSERT(aReadStream);
  MOZ_ASSERT(!mReadStreamList.Contains(aReadStream));
  mReadStreamList.AppendElement(aReadStream);
}

void StreamControl::ForgetReadStream(ReadStream::Controllable* aReadStream) {
  AssertOwningThread();
  MOZ_ALWAYS_TRUE(mReadStreamList.RemoveElement(aReadStream));
}

void StreamControl::NoteClosed(ReadStream::Controllable* aReadStream,
                               const nsID& aId) {
  AssertOwningThread();
  ForgetReadStream(aReadStream);
  NoteClosedAfterForget(aId);
}

StreamControl::~StreamControl() {
  // owning thread only, but can't call virtual AssertOwningThread in destructor
  MOZ_DIAGNOSTIC_ASSERT(mReadStreamList.IsEmpty());
}

void StreamControl::CloseReadStreams(const nsID& aId) {
  AssertOwningThread();
#ifdef MOZ_DIAGNOSTIC_ASSERT_ENABLED
  uint32_t closedCount = 0;
#endif

  ReadStreamList::ForwardIterator iter(mReadStreamList);
  while (iter.HasMore()) {
    RefPtr<ReadStream::Controllable> stream = iter.GetNext();
    if (stream->MatchId(aId)) {
      stream->CloseStream();
#ifdef MOZ_DIAGNOSTIC_ASSERT_ENABLED
      closedCount += 1;
#endif
    }
  }

  MOZ_DIAGNOSTIC_ASSERT(closedCount > 0);
}

void StreamControl::CloseAllReadStreams() {
  AssertOwningThread();

  // A copy of mReadStreamList is necessary here for two reasons:
  // 1. mReadStreamList is modified in StreamControl::ForgetReadStream (called
  //    transitively)
  // 2. the this pointer is deleted by CacheStreamControlParent::Shutdown
  //    (called transitively)
  auto readStreamList = mReadStreamList;
  ReadStreamList::ForwardIterator iter(readStreamList);
  while (iter.HasMore()) {
    iter.GetNext()->CloseStream();
  }
}

void StreamControl::CloseAllReadStreamsWithoutReporting() {
  AssertOwningThread();

  ReadStreamList::ForwardIterator iter(mReadStreamList);
  while (iter.HasMore()) {
    RefPtr<ReadStream::Controllable> stream = iter.GetNext();
    // Note, we cannot trigger IPC traffic here.  So use
    // CloseStreamWithoutReporting().
    stream->CloseStreamWithoutReporting();
  }
}

bool StreamControl::HasEverBeenRead() const {
  ReadStreamList::ForwardIterator iter(mReadStreamList);
  while (iter.HasMore()) {
    if (iter.GetNext()->HasEverBeenRead()) {
      return true;
    }
  }
  return false;
}

}  // namespace cache
}  // namespace dom
}  // namespace mozilla
